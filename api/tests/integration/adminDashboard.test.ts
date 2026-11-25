import { beforeEach, describe, expect, it } from "vitest";
import { CampaignModel } from "../../src/modules/campaign/campaign.model.js";
import { linkFor, participant, shareEvents } from "../helpers/activity.js";
import { adminCookie, createAdmin } from "../helpers/admin.js";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { testApp } from "../helpers/testApp.js";

let cookie = "";
beforeEach(async () => {
  await createAdmin();
  cookie = await adminCookie();
});

const dashboard = (query = "") =>
  testApp().get(`/v1/admin/dashboard${query}`).set("Cookie", cookie);

describe("GET /v1/admin/dashboard", () => {
  it("requires an admin session", async () => {
    await testApp().get("/v1/admin/dashboard").expect(401);
  });

  it("returns KPIs with totals and period-over-period change", async () => {
    const foodi = await createCampaign({ slug: "foodi", name: "Foodi Fair" });
    await createCampaign({ slug: "draft", status: "draft" });
    await CampaignModel.updateOne(
      { _id: foodi._id },
      { stats: { participants: 2, shares: 30, opens: 90 } },
    );
    const a = await participant({ firstLoginAt: daysFrom(NOW, -2) }); // this week
    await participant({ firstLoginAt: daysFrom(NOW, -10) }); // previous week
    const link = await linkFor(foodi._id, a._id);
    await shareEvents(link, [daysFrom(NOW, -1), daysFrom(NOW, -1), daysFrom(NOW, -9)]);

    const res = await dashboard("?range=7d").expect(200);
    expect(res.body.data.kpis).toEqual({
      liveCampaigns: { value: 1, total: 2 },
      participants: { value: 2, changePct: 0 }, // 1 new vs 1 before
      shares: { value: 30, changePct: 100 }, // 2 vs 1
      opens: { value: 90, changePct: 0 },
    });
    expect(res.body.data.counts).toEqual({ scheduled: 0, draft: 1, ended: 0 });
  });

  it("buckets shares per live campaign per Dhaka day", async () => {
    const foodi = await createCampaign({ slug: "foodi", startAt: daysFrom(NOW, -20) });
    const p = await participant();
    const link = await linkFor(foodi._id, p._id);
    // NOW = 12:00 Dhaka on 23 Nov. 23:30 Dhaka on 22 Nov is still "22 Nov".
    await shareEvents(link, [new Date("2026-11-22T17:30:00Z"), NOW, NOW]);

    const res = await dashboard("?chart=7d").expect(200);
    const { days, series } = res.body.data.chart;
    expect(days).toHaveLength(7);
    expect(days.at(-1)).toBe("2026-11-23");
    expect(series[0].values.at(-1)).toBe(2);
    expect(series[0].values.at(-2)).toBe(1);
  });

  it("lists live campaigns with their share of shares, and top sharers by opens", async () => {
    const foodi = await createCampaign({ slug: "foodi", name: "Foodi Fair" });
    const store = await createCampaign({ slug: "store", name: "Store" });
    await CampaignModel.updateOne({ _id: foodi._id }, { "stats.shares": 75 });
    await CampaignModel.updateOne({ _id: store._id }, { "stats.shares": 25 });
    const [a, b, c] = await Promise.all([
      participant({ phone: "01711111111" }),
      participant({ phone: "01722222222" }),
      participant({ phone: "01733333333" }),
    ]);
    await linkFor(foodi._id, a._id, { opens: 10 });
    await linkFor(store._id, b._id, { opens: 40 });
    await linkFor(foodi._id, c._id, { opens: 99, frozen: true }); // disqualified: never shown

    const res = await dashboard().expect(200);
    expect(res.body.data.liveCampaigns.map((l: { sharePct: number }) => l.sharePct)).toEqual([
      75, 25,
    ]);
    expect(
      res.body.data.topSharers.map((t: { phone: string; rank: number }) => [t.rank, t.phone]),
    ).toEqual([
      [1, "01722222222"],
      [2, "01711111111"],
    ]);
  });

  it("shows admin actions in recent activity", async () => {
    const { body } = await testApp()
      .post("/v1/admin/campaigns")
      .set("Cookie", cookie)
      .send({
        name: "New Offer",
        merchantName: "Shop",
        offerTitle: "Deal",
        reward: { title: "Mug" },
        schedule: { startAt: daysFrom(NOW, 1), endAt: daysFrom(NOW, 9) },
      })
      .expect(201);
    expect(body.data.id).toBeDefined();

    const res = await dashboard().expect(200);
    expect(res.body.data.activity[0]).toMatchObject({
      type: "campaign_created",
      actor: { kind: "admin", label: "Admin User" },
      campaignName: "New Offer",
    });
  });
});
