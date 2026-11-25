import { beforeEach, describe, expect, it } from "vitest";
import { CampaignModel } from "../../src/modules/campaign/campaign.model.js";
import { linkFor, participant } from "../helpers/activity.js";
import { adminCookie, createAdmin } from "../helpers/admin.js";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { testApp } from "../helpers/testApp.js";

let cookie = "";
beforeEach(async () => {
  await createAdmin();
  cookie = await adminCookie();
});

async function board(opens: number[], options: { frozen?: number[]; suspicious?: number[] } = {}) {
  const campaign = await createCampaign();
  for (const [i, value] of opens.entries()) {
    const p = await participant({ phone: `0171000000${i}` });
    await linkFor(campaign._id, p._id, {
      opens: value,
      shares: 10 - i,
      lastOpenedAt: daysFrom(NOW, -i), // later index reached its score earlier
      frozen: options.frozen?.includes(i),
      suspicious: options.suspicious?.includes(i),
    });
  }
  return campaign;
}

const get = (id: string, query = "") =>
  testApp().get(`/v1/admin/campaigns/${id}/leaderboard${query}`).set("Cookie", cookie);

describe("GET /v1/admin/campaigns/:id/leaderboard", () => {
  it("ranks by opens, breaks ties by who got there first, and skips disqualified links", async () => {
    const campaign = await board([5, 20, 20, 99], { frozen: [3] });
    const res = await get(campaign.id).expect(200);

    expect(
      res.body.data.items.map((r: { phone: string; rank: number }) => [r.rank, r.phone]),
    ).toEqual([
      [1, "01710000002"], // 20 opens, reached earlier
      [2, "01710000001"],
      [3, "01710000000"],
    ]);
    expect(res.body.data.total).toBe(3);
    expect(res.body.data.items[0]).toMatchObject({ opens: 20, shares: 8, opensPerShare: 2.5 });
  });

  it("continues ranks across pages and respects the campaign's ranking basis", async () => {
    const campaign = await board([1, 2, 3, 4]);
    const page2 = await get(campaign.id, "?page=2&limit=2").expect(200);
    expect(
      page2.body.data.items.map((r: { rank: number; opens: number }) => [r.rank, r.opens]),
    ).toEqual([
      [3, 2],
      [4, 1],
    ]);

    await CampaignModel.updateOne({ _id: campaign._id }, { "reward.rankingBasis": "shares" });
    const byShares = await get(campaign.id, "?limit=1").expect(200);
    expect(byShares.body.data.items[0]).toMatchObject({ rank: 1, shares: 10 });
  });

  it("finds a participant by phone and reports their rank", async () => {
    const campaign = await board([5, 20, 9]);
    const res = await get(campaign.id, "?search=0000002").expect(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ phone: "01710000002", rank: 2 });
  });
});

describe("POST /v1/admin/campaigns/:id/announce-winners", () => {
  const announce = (id: string, body: object = {}, who = cookie) =>
    testApp(daysFrom(NOW, 20))
      .post(`/v1/admin/campaigns/${id}/announce-winners`)
      .set("Cookie", who)
      .send(body);

  it("refuses while the campaign is still running", async () => {
    const campaign = await board([3]);
    const res = await testApp()
      .post(`/v1/admin/campaigns/${campaign.id}/announce-winners`)
      .set("Cookie", cookie)
      .send({})
      .expect(409);
    expect(res.body.error.code).toBe("CAMPAIGN_NOT_ENDED");
  });

  it("freezes the top N as winners once the campaign has ended (only once)", async () => {
    const campaign = await board([5, 20, 9]);
    await CampaignModel.updateOne({ _id: campaign._id }, { "reward.numberOfWinners": 2 });

    const res = await announce(campaign.id).expect(200);
    expect(
      res.body.data.winners.map((w: { rank: number; phone: string }) => [w.rank, w.phone]),
    ).toEqual([
      [1, "01710000001"],
      [2, "01710000002"],
    ]);
    expect(res.body.data.winnerAnnouncedAt).toBeTruthy();

    const again = await announce(campaign.id).expect(409);
    expect(again.body.error.code).toBe("ALREADY_ANNOUNCED");
  });

  it("warns about flagged winners and announces only when confirmed", async () => {
    const campaign = await board([50, 10], { suspicious: [0] });
    const warned = await announce(campaign.id).expect(409);
    expect(warned.body.error).toMatchObject({
      code: "WINNERS_FLAGGED",
      details: { flagged: [{ rank: 1, phone: "01710000000" }] },
    });
    await announce(campaign.id, { force: true }).expect(200);
  });

  it("is admin-only", async () => {
    await createAdmin({ email: "support@example.com", role: "support" });
    const support = await adminCookie("support@example.com");
    const campaign = await board([3]);
    await announce(campaign.id, {}, support).expect(403);
  });
});
