import { describe, expect, it, vi } from "vitest";
import { fixedClock, type Clock } from "../../src/core/utils/clock.js";
import { startOfDhakaDay } from "../../src/core/utils/time.js";
import { TtlCache } from "../../src/core/utils/ttlCache.js";
import { getCampaignLifecycle } from "../../src/modules/campaign/campaign.domain.js";

describe("getCampaignLifecycle", () => {
  const schedule = {
    startAt: new Date("2026-11-10T00:00:00Z"),
    endAt: new Date("2026-11-30T00:00:00Z"),
  };

  it.each([
    ["draft regardless of dates", "draft", "2026-11-20T00:00:00Z", "draft"],
    ["scheduled before start", "published", "2026-11-09T23:59:59Z", "scheduled"],
    ["live at start (inclusive)", "published", "2026-11-10T00:00:00Z", "live"],
    ["live mid-campaign", "published", "2026-11-20T00:00:00Z", "live"],
    ["ended at end (exclusive)", "published", "2026-11-30T00:00:00Z", "ended"],
  ] as const)("%s", (_label, status, now, expected) => {
    expect(getCampaignLifecycle({ status, schedule }, new Date(now))).toBe(expected);
  });
});

describe("startOfDhakaDay", () => {
  it.each([
    ["2026-11-23T06:00:00Z", "2026-11-22T18:00:00.000Z"], // noon Dhaka
    ["2026-11-22T18:00:00Z", "2026-11-22T18:00:00.000Z"], // exactly midnight Dhaka
    ["2026-11-22T17:59:59Z", "2026-11-21T18:00:00.000Z"], // 23:59:59 Dhaka previous day
  ])("%s -> %s", (now, expected) => {
    expect(startOfDhakaDay(new Date(now)).toISOString()).toBe(expected);
  });
});

describe("TtlCache", () => {
  it("serves cached values until the TTL expires", async () => {
    let time = 0;
    const clock: Clock = { now: () => new Date(time) };
    const cache = new TtlCache<number>(1000, clock);
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    expect(await cache.get(load)).toBe(1);
    time = 999;
    expect(await cache.get(load)).toBe(1);
    time = 1001;
    expect(await cache.get(load)).toBe(2);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight load between concurrent callers", async () => {
    const cache = new TtlCache<number>(1000, fixedClock(0));
    const load = vi.fn(() => new Promise<number>((resolve) => setTimeout(() => resolve(7), 10)));

    const results = await Promise.all([cache.get(load), cache.get(load), cache.get(load)]);
    expect(results).toEqual([7, 7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("validUntilLabel", () => {
  it("shows the last live day for an exclusive end (30 Nov ends at 1 Dec 00:00 Dhaka)", async () => {
    const { validUntilLabel } = await import("../../src/core/utils/time.js");
    expect(validUntilLabel(new Date("2026-11-30T18:00:00Z"))).toBe("Valid until 30 Nov");
  });
});

describe("validUntilLabel month names", () => {
  it("uses 3-letter months (Sep, not Sept)", async () => {
    const { validUntilLabel } = await import("../../src/core/utils/time.js");
    expect(validUntilLabel(new Date("2026-09-30T18:00:00Z"))).toBe("Valid until 30 Sep");
  });
});

describe("nextDhakaRun", () => {
  it.each([
    // [now (UTC), frequency, expected (UTC)] — 09:00 Dhaka = 03:00 UTC
    ["2026-11-23T02:00:00Z", "daily", "2026-11-23T03:00:00.000Z"], // before 9am today
    ["2026-11-23T03:00:00Z", "daily", "2026-11-24T03:00:00.000Z"], // exactly 9am -> tomorrow
    ["2026-11-23T02:00:00Z", "weekly", "2026-11-23T03:00:00.000Z"], // Monday morning
    ["2026-11-24T10:00:00Z", "weekly", "2026-11-30T03:00:00.000Z"], // Tuesday -> next Monday
    ["2026-11-23T10:00:00Z", "monthly", "2026-12-01T03:00:00.000Z"],
    ["2026-12-31T20:00:00Z", "monthly", "2027-01-01T03:00:00.000Z"], // 1 Jan 02:00 Dhaka -> 09:00 same day
  ] as const)("%s %s -> %s", async (now, frequency, expected) => {
    const { nextDhakaRun } = await import("../../src/core/utils/time.js");
    expect(nextDhakaRun(new Date(now), frequency).toISOString()).toBe(expected);
  });
});

describe("sanitizeRichText", () => {
  it("keeps formatting tags and strips everything else", async () => {
    const { sanitizeRichText } = await import("../../src/core/security/htmlSanitizer.js");
    expect(
      sanitizeRichText(
        '<h2 style="x">Title</h2><p><b>B</b> <i>I</i> <u>U</u></p><ul><li>One</li></ul><img src=x onerror=alert(1)>',
      ),
    ).toBe("<h2>Title</h2><p><strong>B</strong> <em>I</em> <u>U</u></p><ul><li>One</li></ul>");
  });
});
