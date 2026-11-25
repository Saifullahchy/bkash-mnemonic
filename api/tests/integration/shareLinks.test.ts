import { describe, expect, it } from "vitest";
import { CampaignModel } from "../../src/modules/campaign/campaign.model.js";
import { ShareLinkModel } from "../../src/modules/shareLink/shareLink.model.js";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { loginAs, testApp } from "../helpers/testApp.js";

const linkPath = (id: string) => `/v1/campaigns/${id}/link`;

describe("PUT /v1/campaigns/:id/link", () => {
  it("requires a logged-in participant", async () => {
    const campaign = await createCampaign();
    const res = await testApp().put(linkPath(campaign.id)).expect(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates the link once (201) and returns the same link afterwards (200)", async () => {
    const campaign = await createCampaign();
    const { cookie } = await loginAs();

    const created = await testApp().put(linkPath(campaign.id)).set("Cookie", cookie).expect(201);
    expect(created.body.data).toEqual({
      campaignId: campaign.id,
      code: expect.stringMatching(/^[0-9A-Za-z]{8}$/),
      url: `https://offer-finder.com/s/${created.body.data.code}`,
      opens: 0,
      shares: 0,
    });

    const again = await testApp().put(linkPath(campaign.id)).set("Cookie", cookie).expect(200);
    expect(again.body.data.code).toBe(created.body.data.code);

    const stored = await CampaignModel.findById(campaign.id).lean();
    expect(stored?.stats.participants).toBe(1);
  });

  it("is race-safe: parallel requests yield one link and one participant count", async () => {
    const campaign = await createCampaign();
    const { cookie } = await loginAs();
    const app = testApp();

    const responses = await Promise.all(
      Array.from({ length: 8 }, () => app.put(linkPath(campaign.id)).set("Cookie", cookie)),
    );

    const codes = new Set(responses.map((r) => r.body.data.code as string));
    expect(codes.size).toBe(1);
    expect(await ShareLinkModel.countDocuments()).toBe(1);
    expect((await CampaignModel.findById(campaign.id).lean())?.stats.participants).toBe(1);
  });

  it("gives different participants different codes", async () => {
    const campaign = await createCampaign();
    const a = await loginAs("01712345678");
    const b = await loginAs("01812345678");
    const linkA = await testApp().put(linkPath(campaign.id)).set("Cookie", a.cookie);
    const linkB = await testApp().put(linkPath(campaign.id)).set("Cookie", b.cookie);
    expect(linkA.body.data.code).not.toBe(linkB.body.data.code);
  });

  it("refuses campaigns that are not live (409) and unknown ones (404)", async () => {
    const ended = await createCampaign({ startAt: daysFrom(NOW, -5), endAt: daysFrom(NOW, -1) });
    const { cookie } = await loginAs();

    const res = await testApp().put(linkPath(ended.id)).set("Cookie", cookie).expect(409);
    expect(res.body.error.code).toBe("CAMPAIGN_NOT_LIVE");
    await testApp().put(linkPath("0123456789abcdef01234567")).set("Cookie", cookie).expect(404);
  });
});

describe("POST /v1/track/share", () => {
  it("counts a share at most once per minute per link", async () => {
    const campaign = await createCampaign();
    const { cookie } = await loginAs();
    await testApp().put(linkPath(campaign.id)).set("Cookie", cookie).expect(201);
    const share = (now: Date) =>
      testApp(now).post("/v1/track/share").set("Cookie", cookie).send({ campaignId: campaign.id });

    expect((await share(NOW).expect(202)).body.data).toEqual({ counted: true });
    expect((await share(new Date(NOW.getTime() + 30_000))).body.data).toEqual({ counted: false });
    expect((await share(new Date(NOW.getTime() + 61_000))).body.data).toEqual({ counted: true });

    const link = await ShareLinkModel.findOne().lean();
    expect(link?.shares).toBe(2);
    expect((await CampaignModel.findById(campaign.id).lean())?.stats.shares).toBe(2);
  });

  it("returns 404 if the participant has no link for the campaign yet", async () => {
    const campaign = await createCampaign();
    const { cookie } = await loginAs();
    await testApp()
      .post("/v1/track/share")
      .set("Cookie", cookie)
      .send({ campaignId: campaign.id })
      .expect(404);
  });
});

describe("GET /v1/me/activity", () => {
  it("lists every live home campaign with the participant's own progress", async () => {
    const foodi = await createCampaign({ slug: "foodi", sortOrder: 0 });
    const store = await createCampaign({ slug: "store", sortOrder: 1 });
    await createCampaign({ slug: "draft", status: "draft" });
    const { cookie } = await loginAs();
    const created = await testApp().put(linkPath(foodi.id)).set("Cookie", cookie);
    await ShareLinkModel.updateOne({}, { $set: { opens: 78 } });

    const res = await testApp().get("/v1/me/activity").set("Cookie", cookie).expect(200);

    expect(res.body.data).toEqual([
      {
        campaignId: foodi.id,
        label: "Merchant offer",
        opens: 78,
        shares: 0,
        link: { code: created.body.data.code, url: created.body.data.url },
      },
      { campaignId: store.id, label: "Merchant offer", opens: 0, shares: 0, link: null },
    ]);
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("does not leak another participant's links", async () => {
    const campaign = await createCampaign();
    const a = await loginAs("01712345678");
    const b = await loginAs("01812345678");
    await testApp().put(linkPath(campaign.id)).set("Cookie", a.cookie);

    const res = await testApp().get("/v1/me/activity").set("Cookie", b.cookie).expect(200);
    expect(res.body.data[0].link).toBeNull();
  });

  it("requires login", async () => {
    await testApp().get("/v1/me/activity").expect(401);
  });
});
