/**
 * Business journeys: whole campaigns followed through time across every module
 * (offer site, share links, open counting, admin leaderboard / participants /
 * exports / dashboard). Each test reads as a story of the rules the business
 * relies on — e.g. "a campaign ended: what still works, what stops, and what
 * data is kept".
 *
 * Time is controlled with a fixed clock per request (testApp(now)), so dates
 * such as "the day after the campaign ended" are exact.
 */
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { CampaignModel } from "../../src/modules/campaign/campaign.model.js";
import { ParticipantModel } from "../../src/modules/participant/participant.model.js";
import { ShareLinkModel } from "../../src/modules/shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../src/modules/tracking/linkOpen.model.js";
import { adminCookie, createAdmin } from "../helpers/admin.js";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { friend, landingToken, loginAs, openAs, ownerWithLink } from "../helpers/opens.js";
import { testApp } from "../helpers/testApp.js";

const HOUR = 60 * 60 * 1000;
const after = (base: Date, ms: number) => new Date(base.getTime() + ms);

/** A friend opens the link at `when` (landing page rendered, beacon 5s later). */
async function friendOpens(n: number, code: string, when = NOW) {
  const token = await landingToken(code, when);
  const res = await openAs(friend(n), code, { token, now: after(when, 5_000) });
  return res.body.data.counted as boolean;
}

/** The participant presses Share / Copy link on the offer site at `when`. */
const pressShare = (session: string, campaignId: string, when = NOW) =>
  testApp(when).post("/v1/track/share").set("Cookie", session).send({ campaignId });

const publicList = async (when = NOW): Promise<string[]> => {
  const res = await testApp(when).get("/v1/campaigns").expect(200);
  return (res.body.data as { id: string }[]).map((c) => c.id);
};

const myActivity = async (session: string, when = NOW) =>
  (await testApp(when).get("/v1/me/activity").set("Cookie", session).expect(200)).body.data as {
    campaignId: string;
    opens: number;
    shares: number;
  }[];

async function adminAt(when: Date) {
  const app = testApp(when);
  const cookie = await adminCookie("admin@example.com", app);
  return {
    get: (path: string) => testApp(when).get(path).set("Cookie", cookie),
    post: (path: string, body: object = {}) =>
      testApp(when).post(path).set("Cookie", cookie).send(body),
    xlsx: async (path: string) => {
      const res = await testApp(when)
        .get(path)
        .set("Cookie", cookie)
        .buffer(true)
        .parse((r, done) => {
          const chunks: Buffer[] = [];
          r.on("data", (c: Buffer) => chunks.push(c));
          r.on("end", () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const buffer = res.body as Buffer;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      return wb;
    },
  };
}

beforeEach(async () => {
  await createAdmin();
});

describe("a campaign from start to finish (ended campaign keeps its data)", () => {
  it("counts while live, stops at the end, keeps every number for admins, and crowns the winner", async () => {
    const endAt = daysFrom(NOW, 1);
    const campaign = await createCampaign({ name: "Foodi Fest", endAt });
    const later = daysFrom(NOW, 2); // the day after the campaign ended

    // --- Live: the owner joins, shares, and three friends open the link ---
    const owner = await ownerWithLink(campaign.id, "01711111111");
    await pressShare(owner.session, campaign.id).expect(202);
    expect(await friendOpens(1, owner.code)).toBe(true);
    expect(await friendOpens(2, owner.code)).toBe(true);
    expect(await friendOpens(3, owner.code)).toBe(true);

    // A second participant joins with a smaller score.
    const runnerUp = await ownerWithLink(campaign.id, "01722222222", friend(901));
    expect(await friendOpens(10, runnerUp.code)).toBe(true);

    expect(await myActivity(owner.session)).toEqual([
      expect.objectContaining({ campaignId: campaign.id, opens: 3, shares: 1 }),
    ]);
    expect(await publicList()).toContain(campaign.id);

    // --- The last live moment still counts; the end instant does not ---
    expect(await friendOpens(4, owner.code, after(endAt, -10_000))).toBe(true);
    const atEnd = await testApp(endAt).get(`/v1/share/${owner.code}`).expect(200);
    expect(atEnd.body.data).toMatchObject({ openToken: null, offer: { status: "ended" } });

    // --- After the end: the offer site stops counting but old links still work ---
    expect(await publicList(later)).not.toContain(campaign.id);
    const detail = await testApp(later).get(`/v1/campaigns/${campaign.id}`).expect(200);
    expect(detail.body.data.status).toBe("ended");
    const landing = await testApp(later).get(`/v1/share/${owner.code}`).expect(200);
    expect(landing.body.data).toMatchObject({ openToken: null, offer: { status: "ended" } });

    // A page opened just before the end can't count a minute after it (the open
    // is logged with its reason, not counted). Older tokens expire after 10 min anyway.
    const lateToken = await landingToken(owner.code, after(endAt, -60_000));
    const lateOpen = await openAs(friend(5), owner.code, {
      token: lateToken,
      now: after(endAt, 60_000),
    });
    expect(lateOpen.body.data.counted).toBe(false);
    expect(
      await LinkOpenModel.countDocuments({ counted: false, reason: "campaign_inactive" }),
    ).toBe(1);

    // Sharing again or joining late is refused.
    const share = await pressShare(owner.session, campaign.id, later).expect(409);
    expect(share.body.error.code).toBe("CAMPAIGN_NOT_LIVE");
    const latecomer = await loginAs("01733333333", testApp(later));
    await testApp(later)
      .put(`/v1/campaigns/${campaign.id}/link`)
      .set("Cookie", latecomer.cookie)
      .expect(409);

    // "Your Sharing Activity" on the home page only covers live campaigns.
    expect(await myActivity(owner.session, later)).toEqual([]);

    // --- Admins still see everything the campaign collected ---
    const admin = await adminAt(later);
    const list = await admin.get("/v1/admin/campaigns?status=ended").expect(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        id: campaign.id,
        lifecycle: "ended",
        stats: { participants: 2, shares: 1, opens: 5 },
      }),
    ]);

    const board = await admin.get(`/v1/admin/campaigns/${campaign.id}/leaderboard`).expect(200);
    expect(
      board.body.data.items.map((r: { rank: number; phone: string; opens: number }) => [
        r.rank,
        r.phone,
        r.opens,
      ]),
    ).toEqual([
      [1, "01711111111", 4],
      [2, "01722222222", 1],
    ]);

    const ownerDoc = await ParticipantModel.findOne({ phone: "01711111111" }).lean();
    const ownerDetail = await admin.get(`/v1/admin/participants/${ownerDoc!._id.toString()}`);
    expect(ownerDetail.body.data.links).toEqual([
      expect.objectContaining({
        campaign: { id: campaign.id, name: "Merchant" },
        opens: 4,
        shares: 1,
        rejectedOpens: { campaign_inactive: 1 },
      }),
    ]);

    // Exports after the end include the ended campaign's people and ranking.
    const participantsSheet = (await admin.xlsx("/v1/admin/exports/participants")).getWorksheet(
      "Participants",
    )!;
    const rows = [2, 3].map((r) => participantsSheet.getRow(r).values as unknown[]);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.arrayContaining(["01711111111", 1, 4]),
        expect.arrayContaining(["01722222222", 0, 1]),
      ]),
    );
    const leaderboardBook = await admin.xlsx(
      `/v1/admin/exports/leaderboard?campaignId=${campaign.id}`,
    );
    expect(leaderboardBook.worksheets[0]!.name).toContain("ended");
    expect(leaderboardBook.worksheets[0]!.getRow(2).getCell(2).value).toBe("01711111111");

    // The dashboard no longer counts it as live, but keeps its totals.
    const dashboard = await admin.get("/v1/admin/dashboard").expect(200);
    expect(dashboard.body.data.kpis.liveCampaigns.value).toBe(0);
    expect(dashboard.body.data.counts.ended).toBe(1);
    expect(dashboard.body.data.kpis.opens.value).toBe(5);

    // --- Winners: announced once, frozen even if counters change later ---
    const announced = await admin
      .post(`/v1/admin/campaigns/${campaign.id}/announce-winners`)
      .expect(200);
    expect(announced.body.data.winners).toEqual([
      expect.objectContaining({ rank: 1, phone: "01711111111" }),
    ]);
    await ShareLinkModel.updateOne({ code: runnerUp.code }, { opens: 999 });
    const afterwards = await admin
      .get(`/v1/admin/campaigns/${campaign.id}/leaderboard`)
      .expect(200);
    expect(afterwards.body.data.campaign.winners).toEqual([
      expect.objectContaining({ rank: 1, phone: "01711111111" }),
    ]);
  });

  it("refuses to announce winners for an ended campaign nobody scored in", async () => {
    const campaign = await createCampaign({ endAt: daysFrom(NOW, 1) });
    const admin = await adminAt(daysFrom(NOW, 2));
    const res = await admin.post(`/v1/admin/campaigns/${campaign.id}/announce-winners`).expect(409);
    expect(res.body.error.code).toBe("NO_WINNERS");
  });
});

describe("a scheduled campaign goes live by itself", () => {
  it("is invisible before its start, opens exactly at the start time, and closes exactly at the end", async () => {
    const startAt = daysFrom(NOW, 2);
    const endAt = daysFrom(NOW, 5);
    const campaign = await createCampaign({ startAt, endAt });
    const user = await loginAs("01744444444");

    // Before the start: not listed, no detail page, nobody can join.
    expect(await publicList()).not.toContain(campaign.id);
    await testApp().get(`/v1/campaigns/${campaign.id}`).expect(404);
    const early = await testApp()
      .put(`/v1/campaigns/${campaign.id}/link`)
      .set("Cookie", user.cookie)
      .expect(409);
    expect(early.body.error.code).toBe("CAMPAIGN_NOT_LIVE");

    // Exactly at the start it is live — no admin action needed.
    expect(await publicList(startAt)).toContain(campaign.id);
    const link = await testApp(startAt)
      .put(`/v1/campaigns/${campaign.id}/link`)
      .set("Cookie", user.cookie)
      .expect(201);
    expect(await friendOpens(1, link.body.data.code as string, startAt)).toBe(true);

    // Exactly at the end it is over (the end time is exclusive).
    expect(await publicList(endAt)).not.toContain(campaign.id);
    expect(await publicList(after(endAt, -1))).toContain(campaign.id);
  });
});

describe("drafts never reach the public", () => {
  it("hides a draft from the list, the detail page and link creation", async () => {
    const draft = await createCampaign({ status: "draft" });
    const user = await loginAs("01755555555");
    expect(await publicList()).not.toContain(draft.id);
    await testApp().get(`/v1/campaigns/${draft.id}`).expect(404);
    await testApp().put(`/v1/campaigns/${draft.id}/link`).set("Cookie", user.cookie).expect(404);
  });
});

describe("pausing a live campaign (Active switch off)", () => {
  it("takes it offline everywhere, keeps its counts, and resumes counting when switched back on", async () => {
    const campaign = await createCampaign();
    const owner = await ownerWithLink(campaign.id);
    expect(await friendOpens(1, owner.code)).toBe(true);

    await CampaignModel.updateOne({ _id: campaign._id }, { isActive: false });

    expect(await publicList()).not.toContain(campaign.id);
    await testApp().get(`/v1/campaigns/${campaign.id}`).expect(404);
    await testApp().get(`/v1/share/${owner.code}`).expect(404); // shared links go dark too
    expect(await myActivity(owner.session)).toEqual([]);
    await pressShare(owner.session, campaign.id).expect(404);

    await CampaignModel.updateOne({ _id: campaign._id }, { isActive: true });
    expect(await friendOpens(2, owner.code, after(NOW, HOUR))).toBe(true);
    expect((await ShareLinkModel.findOne({ code: owner.code }).lean())?.opens).toBe(2);
  });
});

describe("an unlisted campaign (Show on home page off)", () => {
  it("is missing from the home page but works through direct and shared links", async () => {
    const campaign = await createCampaign({ showOnHome: false });

    expect(await publicList()).not.toContain(campaign.id);
    await testApp().get(`/v1/campaigns/${campaign.id}`).expect(200);

    const owner = await ownerWithLink(campaign.id);
    expect(await friendOpens(1, owner.code)).toBe(true);
    await pressShare(owner.session, campaign.id).expect(202);

    // Not on the home page, so not in "Your Sharing Activity" either.
    expect(await myActivity(owner.session)).toEqual([]);
  });
});

describe("Count link opens switched off", () => {
  it("still shows the offer and counts shares, but never counts opens", async () => {
    const campaign = await createCampaign();
    const owner = await ownerWithLink(campaign.id);
    const tokenFromBefore = await landingToken(owner.code);

    await CampaignModel.updateOne({ _id: campaign._id }, { "settings.countLinkOpens": false });

    const landing = await testApp().get(`/v1/share/${owner.code}`).expect(200);
    expect(landing.body.data.openToken).toBeNull();
    const open = await openAs(friend(1), owner.code, { token: tokenFromBefore });
    expect(open.body.data.counted).toBe(false);

    await pressShare(owner.session, campaign.id).expect(202);
    const link = await ShareLinkModel.findOne({ code: owner.code }).lean();
    expect(link).toMatchObject({ opens: 0, shares: 1 });
  });
});

describe("several campaigns at once", () => {
  it("keeps each campaign's counts apart, sums them per participant, and applies device caps per campaign", async () => {
    const foodi = await createCampaign({ name: "Foodi" });
    const bata = await createCampaign({ name: "Bata" });

    const owner = await ownerWithLink(foodi.id, "01766666666");
    const bataLink = await testApp()
      .put(`/v1/campaigns/${bata.id}/link`)
      .set("Cookie", owner.session)
      .expect(201);
    const bataCode = bataLink.body.data.code as string;
    expect(bataCode).not.toBe(owner.code); // one personal link per campaign

    // The same friend counts once on each campaign.
    expect(await friendOpens(1, owner.code)).toBe(true);
    expect(await friendOpens(1, bataCode)).toBe(true);
    expect(await friendOpens(1, bataCode)).toBe(false);

    expect((await myActivity(owner.session)).map((a) => [a.campaignId, a.opens])).toEqual(
      expect.arrayContaining([
        [foodi.id, 1],
        [bata.id, 1],
      ]),
    );
    const p = await ParticipantModel.findOne({ phone: "01766666666" }).lean();
    expect(p?.stats).toMatchObject({ opens: 2, campaigns: 2 });
    expect((await CampaignModel.findById(foodi._id).lean())?.stats.opens).toBe(1);
    expect((await CampaignModel.findById(bata._id).lean())?.stats.opens).toBe(1);

    // The 3-links-per-device cap is counted per campaign: one phone that already
    // boosted 3 Foodi links can still open a Bata link.
    const others = await Promise.all(
      ["01777777771", "01777777772", "01777777773"].map((phone, i) =>
        ownerWithLink(foodi.id, phone, friend(950 + i)),
      ),
    );
    const booster = 42;
    for (const o of others) expect(await friendOpens(booster, o.code)).toBe(true);
    const fourth = await ownerWithLink(foodi.id, "01777777774", friend(960));
    expect(await friendOpens(booster, fourth.code)).toBe(false); // 4th Foodi link: capped
    expect(await friendOpens(booster, bataCode)).toBe(true); // different campaign: fine
  });
});

describe("who wins depends on the ranking basis", () => {
  it("ranks by link opens by default and by shares when the campaign says so", async () => {
    const endAt = daysFrom(NOW, 1);
    const campaign = await createCampaign({ endAt });
    const opener = await ownerWithLink(campaign.id, "01788888881", friend(970));
    const sharer = await ownerWithLink(campaign.id, "01788888882", friend(971));

    expect(await friendOpens(1, opener.code)).toBe(true);
    expect(await friendOpens(2, opener.code)).toBe(true);
    await pressShare(sharer.session, campaign.id).expect(202);
    await pressShare(sharer.session, campaign.id, after(NOW, 2 * 60_000)).expect(202);

    const admin = await adminAt(daysFrom(NOW, 2));
    const top = async () =>
      (await admin.get(`/v1/admin/campaigns/${campaign.id}/leaderboard?limit=1`)).body.data.items[0]
        .phone as string;

    expect(await top()).toBe("01788888881"); // opens (default)
    await CampaignModel.updateOne({ _id: campaign._id }, { "reward.rankingBasis": "shares" });
    expect(await top()).toBe("01788888882");

    const res = await admin.post(`/v1/admin/campaigns/${campaign.id}/announce-winners`).expect(200);
    expect(res.body.data.winners[0].phone).toBe("01788888882");
  });

  it("counts a Share press at most once a minute (double clicks don't inflate shares)", async () => {
    const campaign = await createCampaign();
    const owner = await ownerWithLink(campaign.id);
    await pressShare(owner.session, campaign.id).expect(202);
    const again = await pressShare(owner.session, campaign.id, after(NOW, 30_000)).expect(202);
    expect(again.body.data.counted).toBe(false);
    const nextMinute = await pressShare(owner.session, campaign.id, after(NOW, 61_000));
    expect(nextMinute.body.data.counted).toBe(true);
    expect((await ShareLinkModel.findOne({ code: owner.code }).lean())?.shares).toBe(2);
  });
});

describe("disqualified participants", () => {
  it("lose their place and can't win, while their history stays for the audit trail", async () => {
    const endAt = daysFrom(NOW, 1);
    const campaign = await createCampaign({ endAt });
    const cheater = await ownerWithLink(campaign.id, "01799999991", friend(980));
    const honest = await ownerWithLink(campaign.id, "01799999992", friend(981));
    for (const n of [1, 2, 3]) expect(await friendOpens(n, cheater.code)).toBe(true);
    expect(await friendOpens(4, honest.code)).toBe(true);

    const live = await adminAt(NOW);
    const cheaterDoc = await ParticipantModel.findOne({ phone: "01799999991" }).lean();
    await live
      .post(`/v1/admin/participants/${cheaterDoc!._id.toString()}/disqualify`, {
        reason: "Bought opens",
      })
      .expect(200);

    // No more counting for them; their past opens are kept, not deleted.
    expect(await friendOpens(5, cheater.code, after(NOW, HOUR))).toBe(false);
    expect(
      await LinkOpenModel.countDocuments({ shareLinkId: { $exists: true }, counted: true }),
    ).toBe(4);

    const ended = await adminAt(daysFrom(NOW, 2));
    const board = await ended.get(`/v1/admin/campaigns/${campaign.id}/leaderboard`).expect(200);
    expect(board.body.data.items.map((r: { phone: string }) => r.phone)).toEqual(["01799999992"]);
    const res = await ended.post(`/v1/admin/campaigns/${campaign.id}/announce-winners`).expect(200);
    expect(res.body.data.winners.map((w: { phone: string }) => w.phone)).toEqual(["01799999992"]);

    // They can still sign in to the offer site (they just stop scoring).
    await loginAs("01799999991");
  });
});
