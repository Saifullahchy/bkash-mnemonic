import { describe, expect, it } from "vitest";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { testApp } from "../helpers/testApp.js";

describe("GET /v1/campaigns", () => {
  it("lists only published, active, home-visible campaigns that are live now", async () => {
    const live = await createCampaign({ slug: "live" });
    await createCampaign({ slug: "draft", status: "draft" });
    await createCampaign({ slug: "inactive", isActive: false });
    await createCampaign({ slug: "hidden", showOnHome: false });
    await createCampaign({ slug: "scheduled", startAt: daysFrom(NOW, 2), endAt: daysFrom(NOW, 5) });
    await createCampaign({ slug: "ended", startAt: daysFrom(NOW, -10), endAt: daysFrom(NOW, -1) });

    const res = await testApp().get("/v1/campaigns").expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.meta).toEqual({ count: 1 });
    expect(res.body.data.map((o: { slug: string }) => o.slug)).toEqual(["live"]);
    expect(res.body.data[0].id).toBe(live._id.toString());
  });

  it("treats endAt as exclusive and startAt as inclusive", async () => {
    await createCampaign({ slug: "starts-now", startAt: NOW, endAt: daysFrom(NOW, 1) });
    await createCampaign({ slug: "ends-now", startAt: daysFrom(NOW, -1), endAt: NOW });

    const res = await testApp().get("/v1/campaigns").expect(200);
    expect(res.body.data.map((o: { slug: string }) => o.slug)).toEqual(["starts-now"]);
  });

  it("orders by sortOrder, then by soonest end date", async () => {
    await createCampaign({ slug: "b", sortOrder: 1, endAt: daysFrom(NOW, 9) });
    await createCampaign({ slug: "c", sortOrder: 1, endAt: daysFrom(NOW, 3) });
    await createCampaign({ slug: "a", sortOrder: 0, endAt: daysFrom(NOW, 20) });

    const res = await testApp().get("/v1/campaigns").expect(200);
    expect(res.body.data.map((o: { slug: string }) => o.slug)).toEqual(["a", "c", "b"]);
  });

  it("returns the public DTO only (no admin fields) and is cacheable", async () => {
    await createCampaign({ slug: "foodi", name: "Foodi Food Fair", opens: 78540 });

    const res = await testApp().get("/v1/campaigns").expect(200);
    const offer = res.body.data[0];

    expect(offer).toEqual({
      id: expect.any(String),
      slug: "foodi",
      merchantName: "Merchant",
      title: "Foodi Food Fair",
      subtitle: "Tk 200 discount",
      description: "Description",
      bannerUrl: "https://cdn.example.com/banner.png",
      logoUrl: null,
      validityLabel: "Valid until 3 Dec",
      startAt: expect.any(String),
      endAt: expect.any(String),
      status: "live",
      reward: {
        title: "iPhone 18 Pro",
        rank: 1,
        imageUrl: "https://cdn.example.com/prize.png",
        // No tile picture of its own → reuses the reward banner's.
        tileImageUrl: "https://cdn.example.com/prize.png",
      },
      totalOpens: 78540,
    });
    expect(res.headers["cache-control"]).toContain("public");
  });
});

describe("GET /v1/campaigns/:id", () => {
  it("returns a live campaign", async () => {
    const campaign = await createCampaign();
    const res = await testApp().get(`/v1/campaigns/${campaign._id.toString()}`).expect(200);
    expect(res.body.data.status).toBe("live");
  });

  it("still returns an ended campaign so old shared links keep working", async () => {
    const campaign = await createCampaign({
      startAt: daysFrom(NOW, -10),
      endAt: daysFrom(NOW, -1),
    });
    const res = await testApp().get(`/v1/campaigns/${campaign._id.toString()}`).expect(200);
    expect(res.body.data.status).toBe("ended");
  });

  it.each([
    ["draft", { status: "draft" as const }],
    ["scheduled", { startAt: daysFrom(NOW, 1), endAt: daysFrom(NOW, 5) }],
    ["inactive", { isActive: false }],
  ])("hides a %s campaign as 404", async (_label, overrides) => {
    const campaign = await createCampaign(overrides);
    const res = await testApp().get(`/v1/campaigns/${campaign._id.toString()}`).expect(404);
    expect(res.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("rejects a malformed id with a 400 validation error", async () => {
    const res = await testApp().get("/v1/campaigns/not-an-id").expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("id");
  });
});

describe("Campaign model invariants", () => {
  it("rejects a campaign whose end is not after its start", async () => {
    await expect(createCampaign({ startAt: NOW, endAt: NOW })).rejects.toThrow(
      "endAt must be after startAt",
    );
  });
});
