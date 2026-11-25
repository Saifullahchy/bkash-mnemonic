import { beforeEach, describe, expect, it } from "vitest";
import { ActivityModel } from "../../src/modules/activity/activity.model.js";
import { CampaignModel } from "../../src/modules/campaign/campaign.model.js";
import { ParticipantModel } from "../../src/modules/participant/participant.model.js";
import { ShareEventModel } from "../../src/modules/shareLink/shareEvent.model.js";
import { ShareLinkModel } from "../../src/modules/shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../src/modules/tracking/linkOpen.model.js";
import { rebuildCounters } from "../../src/scripts/lib/rebuildCounters.js";
import { countedOpens, linkFor, participant } from "../helpers/activity.js";
import { adminCookie, createAdmin } from "../helpers/admin.js";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { counted, friend, ownerWithLink } from "../helpers/opens.js";
import { testApp } from "../helpers/testApp.js";

let cookie = "";
beforeEach(async () => {
  await createAdmin();
  cookie = await adminCookie();
});
const admin = () => testApp();

describe("GET /v1/admin/participants", () => {
  it("lists most-sharing participants first with campaigns, status and summary", async () => {
    const foodi = await createCampaign({ slug: "foodi" });
    const a = await participant({ phone: "01711111111", lastActiveAt: NOW });
    const b = await participant({ phone: "01722222222", lastActiveAt: daysFrom(NOW, -10) });
    await linkFor(foodi._id, a._id, { shares: 3, opens: 9 });
    await linkFor(foodi._id, b._id, { shares: 7, opens: 2 });

    const res = await admin().get("/v1/admin/participants").set("Cookie", cookie).expect(200);
    expect(
      res.body.data.map((r: { phone: string; status: string }) => [r.phone, r.status]),
    ).toEqual([
      ["01722222222", "idle"],
      ["01711111111", "active"],
    ]);
    expect(res.body.data[0]).toMatchObject({
      shares: 7,
      opens: 2,
      campaigns: [{ id: foodi.id, name: "Merchant" }],
    });
    expect(res.body.meta.summary).toMatchObject({ total: 2, newToday: 2, avgSharesPerUser: 5 });
  });

  it("filters by campaign, phone search and status", async () => {
    const foodi = await createCampaign({ slug: "foodi" });
    const a = await participant({ phone: "01711111111" });
    await participant({ phone: "01722222222" });
    await participant({ phone: "01733333333", status: "disqualified" });
    await linkFor(foodi._id, a._id);

    const list = (q: string) => admin().get(`/v1/admin/participants?${q}`).set("Cookie", cookie);
    expect((await list(`campaignId=${foodi.id}`)).body.data).toHaveLength(1);
    expect((await list("search=7222")).body.data[0].phone).toBe("01722222222");
    expect((await list("status=disqualified")).body.data[0].phone).toBe("01733333333");
  });
});

describe("moderation", () => {
  it("disqualifying removes a participant from rankings and stops counting; reinstating restores", async () => {
    const campaign = await createCampaign();
    const owner = await ownerWithLink(campaign.id);
    const p = await ParticipantModel.findOne({ phone: "01711111111" });
    const id = p!._id.toString();

    const res = await admin()
      .post(`/v1/admin/participants/${id}/disqualify`)
      .set("Cookie", cookie)
      .send({ reason: "Bought fake opens" })
      .expect(200);
    expect(res.body.data).toMatchObject({
      status: "disqualified",
      disqualifiedReason: "Bought fake opens",
    });
    expect((await ShareLinkModel.findOne({ code: owner.code }))?.flags.frozen).toBe(true);
    expect(await counted(friend(1), owner.code)).toBe(false);

    const board = await admin()
      .get(`/v1/admin/campaigns/${campaign.id}/leaderboard`)
      .set("Cookie", cookie);
    expect(board.body.data.items).toHaveLength(0);

    await admin().post(`/v1/admin/participants/${id}/reinstate`).set("Cookie", cookie).expect(200);
    expect(await counted(friend(2), owner.code)).toBe(true);
  });

  it("voids a link's counted opens and fixes every counter exactly", async () => {
    const campaign = await createCampaign();
    const p = await participant();
    const link = await linkFor(campaign._id, p._id, { opens: 6, suspicious: true });
    await CampaignModel.updateOne({ _id: campaign._id }, { "stats.opens": 10 });
    await countedOpens(link, 6);

    const res = await admin()
      .post(`/v1/admin/share-links/${link.id}/void-opens`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.data).toEqual({ voided: 6 });

    const fresh = await ShareLinkModel.findById(link._id).lean();
    expect(fresh).toMatchObject({ opens: 0, flags: { suspicious: false } });
    expect((await CampaignModel.findById(campaign._id).lean())?.stats.opens).toBe(4);
    expect((await ParticipantModel.findById(p._id).lean())?.stats.opens).toBe(0);
    expect(await LinkOpenModel.countDocuments({ reason: "voided", counted: false })).toBe(6);
    expect(await ActivityModel.countDocuments({ type: "opens_voided" })).toBe(1);
  });

  it("after a void, the same people can't count again on that link; new friends still can", async () => {
    const campaign = await createCampaign();
    const owner = await ownerWithLink(campaign.id);
    for (const n of [1, 2, 3]) expect(await counted(friend(n), owner.code)).toBe(true);
    const link = await ShareLinkModel.findOne({ code: owner.code }).lean();

    await admin()
      .post(`/v1/admin/share-links/${link!._id.toString()}/void-opens`)
      .set("Cookie", cookie)
      .expect(200);

    // The voided browsers re-open (and even try from a private window): no count.
    expect(await counted(friend(1), owner.code)).toBe(false);
    expect(await counted(friend(2), owner.code, { withVisitorCookie: false })).toBe(false);
    // A genuinely new friend counts from zero.
    expect(await counted(friend(4), owner.code)).toBe(true);

    expect((await ShareLinkModel.findById(link!._id).lean())?.opens).toBe(1);
    expect((await CampaignModel.findById(campaign._id).lean())?.stats.opens).toBe(1);
    expect(await LinkOpenModel.countDocuments({ reason: "voided" })).toBe(3);
  });

  it("a void doesn't free a phone up to boost more links (the 3-links cap still counts it)", async () => {
    const campaign = await createCampaign();
    const owners = await Promise.all(
      ["01711111111", "01722222222", "01733333333", "01744444444"].map((phone, i) =>
        ownerWithLink(campaign.id, phone, friend(900 + i)),
      ),
    );
    const booster = friend(42);
    for (const o of owners.slice(0, 3)) expect(await counted(booster, o.code)).toBe(true);

    const first = await ShareLinkModel.findOne({ code: owners[0]!.code }).lean();
    await admin()
      .post(`/v1/admin/share-links/${first!._id.toString()}/void-opens`)
      .set("Cookie", cookie)
      .expect(200);

    expect(await counted(booster, owners[3]!.code)).toBe(false); // still at the 3-link limit
  });

  it("shows why opens were rejected in the participant detail", async () => {
    const campaign = await createCampaign();
    const p = await participant();
    const link = await linkFor(campaign._id, p._id);
    await countedOpens(link, 3, { counted: false, reason: "device_cap" });
    await countedOpens(link, 1, { counted: false, reason: "self_open" });

    const res = await admin()
      .get(`/v1/admin/participants/${p.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(res.body.data.links[0].rejectedOpens).toEqual({ device_cap: 3, self_open: 1 });
  });

  it("flags links whose opens come mostly from one network, once", async () => {
    const campaign = await createCampaign();
    const p = await participant();
    const link = await linkFor(campaign._id, p._id);
    const normal = await linkFor(campaign._id, (await participant())._id);
    await countedOpens(link, 18, { subnetHash: "same-network", createdAt: daysFrom(NOW, -0.5) });
    await countedOpens(normal, 18, { createdAt: daysFrom(NOW, -0.5) });

    const scan = () => admin().post("/v1/admin/moderation/scan").set("Cookie", cookie);
    expect((await scan()).body.data).toEqual({ flagged: 1 });
    expect((await scan()).body.data).toEqual({ flagged: 0 });

    const flagged = await ShareLinkModel.findById(link._id).lean();
    expect(flagged?.flags).toMatchObject({
      suspicious: true,
      suspiciousReason: expect.stringContaining("one network"),
    });

    await admin()
      .post(`/v1/admin/share-links/${link.id}/clear-flag`)
      .set("Cookie", cookie)
      .expect(204);
    await admin()
      .post(`/v1/admin/share-links/${link.id}/clear-flag`)
      .set("Cookie", cookie)
      .expect(409);
  });

  it("keeps support staff read-only", async () => {
    await createAdmin({ email: "support@example.com", role: "support" });
    const support = await adminCookie("support@example.com");
    const p = await participant();
    await admin().get("/v1/admin/participants").set("Cookie", support).expect(200);
    await admin()
      .post(`/v1/admin/participants/${p.id}/disqualify`)
      .set("Cookie", support)
      .send({ reason: "nope" })
      .expect(403);
  });
});

describe("counters stay consistent", () => {
  it("updates participant totals, share events and activity through the real flows", async () => {
    const campaign = await createCampaign();
    const owner = await ownerWithLink(campaign.id);
    await testApp()
      .post("/v1/track/share")
      .set("Cookie", owner.session)
      .send({ campaignId: campaign.id })
      .expect(202);
    expect(await counted(friend(1), owner.code)).toBe(true);

    const p = await ParticipantModel.findOne({ phone: "01711111111" }).lean();
    expect(p?.stats).toEqual({ shares: 1, opens: 1, campaigns: 1 });
    expect(p?.campaignIds.map(String)).toEqual([campaign.id]);
    expect(await ShareEventModel.countDocuments()).toBe(1);
    expect(await ActivityModel.countDocuments({ type: "participant_joined" })).toBe(1);
  });

  it("rebuildCounters restores every counter from source records", async () => {
    const campaign = await createCampaign();
    const p = await participant();
    const link = await linkFor(campaign._id, p._id);
    await countedOpens(link, 4);
    await ShareLinkModel.updateOne({ _id: link._id }, { opens: 999 });
    await CampaignModel.updateOne({ _id: campaign._id }, { "stats.opens": 123456 });

    await rebuildCounters();
    expect((await ShareLinkModel.findById(link._id).lean())?.opens).toBe(4);
    expect((await CampaignModel.findById(campaign._id).lean())?.stats).toMatchObject({
      opens: 4,
      participants: 1,
    });
    expect((await ParticipantModel.findById(p._id).lean())?.stats.opens).toBe(4);
  });
});
