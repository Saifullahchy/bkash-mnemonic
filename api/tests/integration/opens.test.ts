import { describe, expect, it } from "vitest";
import { CampaignModel } from "../../src/modules/campaign/campaign.model.js";
import { ParticipantModel } from "../../src/modules/participant/participant.model.js";
import { ShareLinkModel } from "../../src/modules/shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../src/modules/tracking/linkOpen.model.js";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { at, counted, friend, landingToken, openAs, ownerWithLink } from "../helpers/opens.js";
import { testApp } from "../helpers/testApp.js";

async function setup() {
  const campaign = await createCampaign();
  const owner = await ownerWithLink(campaign.id);
  return { campaignId: campaign.id, ...owner };
}

const linkOpens = async (code: string) => (await ShareLinkModel.findOne({ code }).lean())?.opens;
const reasons = async () =>
  (await LinkOpenModel.find().sort({ _id: 1 }).lean()).map((o) => o.reason);

describe("GET /v1/share/:code (landing page data)", () => {
  it("returns the offer and a single-use open token, without revealing the sharer", async () => {
    const { code } = await setup();
    const res = await testApp().get(`/v1/share/${code}`).expect(200);

    expect(res.body.data).toMatchObject({
      code,
      offer: { status: "live" },
      openToken: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain("01711111111");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("issues no token once the campaign has ended (old links still show the offer)", async () => {
    const { code, campaignId } = await setup();
    await CampaignModel.updateOne({ _id: campaignId }, { "schedule.endAt": daysFrom(NOW, -0.5) });
    const res = await testApp().get(`/v1/share/${code}`).expect(200);
    expect(res.body.data).toMatchObject({ offer: { status: "ended" }, openToken: null });
  });

  it("404s unknown and malformed codes", async () => {
    await testApp().get("/v1/share/AAAAAAAA").expect(404);
    await testApp().get("/v1/share/bad").expect(400);
  });
});

describe("POST /v1/track/open — counting", () => {
  it("counts a friend's first open on the link and the campaign", async () => {
    const { code, campaignId, session } = await setup();

    const res = await openAs(friend(1), code);

    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ counted: true });
    expect(await linkOpens(code)).toBe(1);
    expect((await CampaignModel.findById(campaignId).lean())?.stats.opens).toBe(1);

    const activity = await testApp().get("/v1/me/activity").set("Cookie", session);
    expect(activity.body.data[0].opens).toBe(1);
  });

  it("gives a first-time visitor a cookie and counts them", async () => {
    const { code } = await setup();
    const res = await openAs(friend(1), code, { withVisitorCookie: false });

    expect(res.body.data.counted).toBe(true);
    expect((res.headers["set-cookie"] as unknown as string[]).join(";")).toMatch(
      /ofv=[0-9a-f-]{36}/,
    );
  });

  it("counts different friends separately (30 friends → 30)", async () => {
    const { code } = await setup();
    for (let i = 1; i <= 30; i++) expect(await counted(friend(i), code)).toBe(true);
    expect(await linkOpens(code)).toBe(30);
  });
});

describe("one link never counts the same person twice", () => {
  it("ignores the same browser opening again (refresh / re-open)", async () => {
    const { code } = await setup();
    expect(await counted(friend(1), code)).toBe(true);
    expect(await counted(friend(1), code)).toBe(false);
    expect(await counted(friend(1), code, { now: at(3 * 60 * 60_000) })).toBe(false);
    expect(await linkOpens(code)).toBe(1);
  });

  it("ignores the same device in incognito / after clearing cookies", async () => {
    const { code } = await setup();
    const phone = friend(1);
    expect(await counted(phone, code)).toBe(true);
    const incognito = { ...phone, visitorId: "11111111-2222-4333-8444-555555555555" };
    expect(await counted(incognito, code)).toBe(false);
    expect(await counted(phone, code, { withVisitorCookie: false })).toBe(false);
    expect(await linkOpens(code)).toBe(1);
  });

  it("is race-safe: parallel opens from one browser count exactly once", async () => {
    const { code } = await setup();
    const tokens = await Promise.all(Array.from({ length: 6 }, () => landingToken(code)));
    const results = await Promise.all(tokens.map((token) => counted(friend(1), code, { token })));

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await linkOpens(code)).toBe(1);
  });
});

describe("bots and link previews never count", () => {
  it.each([
    [
      "Facebook/Messenger preview",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    ],
    ["WhatsApp preview", "WhatsApp/2.23.20.0 A"],
    ["Telegram preview", "TelegramBot (like TwitterBot)"],
    ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
    [
      "headless browser",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0 Safari/537.36",
    ],
    ["curl script", "curl/8.4.0"],
    ["python script", "python-requests/2.31.0"],
    ["empty user agent", ""],
  ])("%s → quietly not counted, nothing recorded", async (_label, userAgent) => {
    const { code } = await setup();
    const res = await openAs(friend(1, { userAgent }), code);
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ counted: false });
    expect(await LinkOpenModel.countDocuments()).toBe(0);
    expect(await linkOpens(code)).toBe(0);
  });

  it("treats a filled honeypot field as a bot", async () => {
    const { code } = await setup();
    expect(await counted(friend(1), code, { honeypot: "http://spam" })).toBe(false);
    expect(await reasons()).toEqual(["bot"]);
  });
});

describe("open tokens stop direct API scripting", () => {
  it("requires a token (400)", async () => {
    const { code } = await setup();
    const res = await testApp({ trustProxy: 1 })
      .post("/v1/track/open")
      .set("User-Agent", friend(1).userAgent)
      .send({ code });
    expect(res.status).toBe(400);
  });

  it("rejects forged, reused, too-early, expired and other-link tokens", async () => {
    const { code, campaignId } = await setup();
    const other = await ownerWithLink(campaignId, "01722222222", friend(901));

    const token = await landingToken(code);
    expect(await counted(friend(1), code, { token: `${token.slice(0, -2)}xx` })).toBe(false); // forged
    expect(await counted(friend(2), code, { token, now: at(1_000) })).toBe(false); // too early (<2s)
    expect(
      await counted(friend(3), code, { token: await landingToken(code), now: at(11 * 60_000) }),
    ).toBe(false); // expired
    expect(await counted(friend(4), code, { token: await landingToken(other.code) })).toBe(false); // other link

    const fresh = await landingToken(code);
    expect(await counted(friend(5), code, { token: fresh })).toBe(true);
    expect(await counted(friend(6), code, { token: fresh })).toBe(false); // reused

    expect(await reasons()).toEqual([
      "invalid_token",
      "invalid_token",
      "invalid_token",
      "invalid_token",
      "counted",
      "invalid_token",
    ]);
  });
});

describe("self-opens never count", () => {
  it("ignores the owner while logged in, even from another device", async () => {
    const { code, session } = await setup();
    expect(await counted(friend(50), code, { sessionCookie: session })).toBe(false);
    expect(await reasons()).toEqual(["self_open"]);
  });

  it("ignores the owner's browser after logging out", async () => {
    const { code, device } = await setup();
    expect(await counted({ ...device, ip: "172.16.5.5" }, code)).toBe(false);
    expect(await reasons()).toEqual(["self_open"]);
  });

  it("ignores the owner's device in a private window", async () => {
    const { code, device } = await setup();
    const privateWindow = { ...device, visitorId: "99999999-8888-4777-8666-555555555555" };
    expect(await counted(privateWindow, code)).toBe(false);
    expect(await reasons()).toEqual(["self_open"]);
  });
});

describe("count-boosting caps", () => {
  it("lets one device boost at most 3 different people's links per campaign", async () => {
    const campaign = await createCampaign();
    const owners = await Promise.all(
      [1, 2, 3, 4].map((i) => ownerWithLink(campaign.id, `0171000000${i}`, friend(900 + i))),
    );
    const farmPhone = friend(1);

    const results = [];
    for (const owner of owners) results.push(await counted(farmPhone, owner.code));
    expect(results).toEqual([true, true, true, false]);
    expect((await reasons()).at(-1)).toBe("device_cap");
  });

  it("caps opens on one link from the same network at 5 per hour", async () => {
    const { code } = await setup();
    const sameNetwork = (n: number) => friend(n, { ip: `203.0.113.${n}` });

    const results = [];
    for (let i = 1; i <= 6; i++) results.push(await counted(sameNetwork(i), code));
    expect(results).toEqual([true, true, true, true, true, false]);
    expect((await reasons()).at(-1)).toBe("subnet_cap");

    // An hour later the network may contribute again.
    const later = at(61 * 60_000);
    expect(
      await counted(sameNetwork(7), code, {
        token: await landingToken(code, at(61 * 60_000 - 5_000)),
        now: later,
      }),
    ).toBe(true);
  });

  it("caps sudden bursts on one link (velocity per 10 minutes)", async () => {
    const { code, campaignId } = await setup();
    await CampaignModel.updateOne(
      { _id: campaignId },
      { "settings.antiAbuse.maxOpensPerLinkPer10Min": 3 },
    );
    const results = [];
    for (let i = 1; i <= 4; i++) results.push(await counted(friend(i), code));
    expect(results).toEqual([true, true, true, false]);
    expect((await reasons()).at(-1)).toBe("velocity_cap");
  });
});

describe("eligibility", () => {
  it("stops counting when the campaign ends, even with a token issued before", async () => {
    const { code, campaignId } = await setup();
    await CampaignModel.updateOne({ _id: campaignId }, { "schedule.endAt": at(3_000) });
    expect(await counted(friend(1), code, { now: at(5_000) })).toBe(false);
    expect(await reasons()).toEqual(["campaign_inactive"]);
  });

  it("does not count for frozen links or disqualified owners", async () => {
    const { code } = await setup();
    await ShareLinkModel.updateOne({ code }, { "flags.frozen": true });
    expect(await counted(friend(1), code)).toBe(false);

    await ShareLinkModel.updateOne({ code }, { "flags.frozen": false });
    await ParticipantModel.updateOne({ phone: "01711111111" }, { status: "disqualified" });
    expect(await counted(friend(2), code)).toBe(false);
    expect(await reasons()).toEqual(["link_frozen", "link_frozen"]);
  });
});

describe("rate limiting", () => {
  it("silently stops counting after 10 attempts per browser per hour", async () => {
    const { code } = await setup();
    const app = testApp({ now: at(5_000), trustProxy: 1, rateLimitEnabled: true });
    const tokens = await Promise.all(Array.from({ length: 11 }, () => landingToken(code)));

    const statuses = [];
    for (const token of tokens) {
      const res = await app
        .post("/v1/track/open")
        .set("User-Agent", friend(1).userAgent)
        .set("X-Forwarded-For", friend(1).ip)
        .set("Cookie", `ofv=${friend(1).visitorId}`)
        .send({ code, token });
      statuses.push(`${res.status}:${String(res.body.data.counted)}`);
    }

    // Looks normal to the client (202), but the 11th never reached the counter.
    expect(statuses.at(-1)).toBe("202:false");
    expect(await LinkOpenModel.countDocuments()).toBe(10);
  });
});
