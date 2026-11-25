import { describe, expect, it } from "vitest";
import { createParticipant, createTerms, daysFrom, NOW } from "../helpers/factories.js";
import { testApp } from "../helpers/testApp.js";

describe("GET /v1/stats/public", () => {
  it("counts participants active since midnight in Asia/Dhaka", async () => {
    // NOW = 2026-11-23 12:00 in Dhaka; the Dhaka day started at 2026-11-22T18:00Z.
    await createParticipant(new Date("2026-11-22T18:00:00.000Z")); // 00:00 Dhaka -> counts
    await createParticipant(new Date("2026-11-23T05:59:00.000Z")); // today -> counts
    await createParticipant(new Date("2026-11-22T17:59:59.000Z")); // yesterday 23:59 Dhaka
    await createParticipant(daysFrom(NOW, -3));

    const res = await testApp().get("/v1/stats/public").expect(200);
    expect(res.body.data).toEqual({ peopleSharingToday: 2 });
  });
});

describe("GET /v1/content/terms", () => {
  it("returns the current Terms & Conditions", async () => {
    await createTerms();
    const res = await testApp().get("/v1/content/terms").expect(200);
    expect(res.body.data).toEqual({
      title: "Terms & Conditions",
      summary: "Summary",
      // Content saved before the rich-text editor is converted to HTML.
      html: "<h3>1. Eligibility</h3><p>Open to all.</p>",
      version: 3,
      updatedAt: NOW.toISOString(),
    });
  });

  it("returns 404 when terms were never published", async () => {
    const res = await testApp().get("/v1/content/terms").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
