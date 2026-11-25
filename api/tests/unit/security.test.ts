import { describe, expect, it } from "vitest";
import { isBotUserAgent } from "../../src/core/security/botDetector.js";
import { Fingerprinter, subnetOf } from "../../src/core/security/fingerprint.js";
import { OpenTokens } from "../../src/core/security/openTokens.js";

describe("subnetOf", () => {
  it.each([
    ["203.0.113.77", "203.0.113.0/24"],
    ["::ffff:203.0.113.77", "203.0.113.0/24"],
    ["2001:db8:abcd:12::1", "2001:0db8:abcd:0012::/64"],
    ["2001:db8::1", "2001:0db8:0000:0000::/64"],
    ["garbage", "unknown"],
  ])("%s → %s", (ip, expected) => {
    expect(subnetOf(ip)).toBe(expected);
  });
});

describe("Fingerprinter", () => {
  const fp = new Fingerprinter("salt-salt-salt-salt");
  const base = { ip: "203.0.113.7", userAgent: "Mozilla/5.0 Android", acceptLanguage: "bn" };

  it("is stable for the same device and never contains the raw IP", () => {
    const a = fp.compute(base);
    expect(fp.compute(base)).toEqual(a);
    expect(JSON.stringify(a)).not.toContain("203.0.113");
  });

  it("separates devices but groups the same network", () => {
    const a = fp.compute(base);
    const otherPhone = fp.compute({ ...base, userAgent: "Mozilla/5.0 iPhone" });
    const neighbour = fp.compute({ ...base, ip: "203.0.113.99" });
    expect(otherPhone.deviceHash).not.toBe(a.deviceHash);
    expect(neighbour.deviceHash).not.toBe(a.deviceHash);
    expect(neighbour.subnetHash).toBe(a.subnetHash);
  });

  it("depends on the salt", () => {
    expect(new Fingerprinter("another-salt-value").compute(base)).not.toEqual(fp.compute(base));
  });
});

describe("OpenTokens", () => {
  const tokens = new OpenTokens("x".repeat(40));
  const t0 = new Date("2026-11-23T06:00:00Z");
  const after = (ms: number) => new Date(t0.getTime() + ms);

  it("accepts a token between 2 seconds and 10 minutes old", () => {
    const token = tokens.issue("Ab3xK9pQ", t0);
    expect(tokens.verify(token, "Ab3xK9pQ", after(2_000)).ok).toBe(true);
    expect(tokens.verify(token, "Ab3xK9pQ", after(10 * 60_000)).ok).toBe(true);
  });

  it.each([
    ["too_early", 1_999, "Ab3xK9pQ"],
    ["expired", 10 * 60_000 + 1, "Ab3xK9pQ"],
    ["wrong_code", 5_000, "Zz9yX8wV"],
  ])("rejects %s", (reason, ageMs, code) => {
    const token = tokens.issue("Ab3xK9pQ", t0);
    expect(tokens.verify(token, code, after(ageMs))).toEqual({ ok: false, reason });
  });

  it("rejects tampered payloads and foreign secrets", () => {
    const token = tokens.issue("Ab3xK9pQ", t0);
    const [payload, sig] = token.split(".");
    const forgedPayload = Buffer.from(`Ab3xK9pQ.nonce.${t0.getTime() - 60_000}`).toString(
      "base64url",
    );
    expect(tokens.verify(`${forgedPayload}.${sig}`, "Ab3xK9pQ", after(5_000)).ok).toBe(false);
    expect(new OpenTokens("y".repeat(40)).verify(token, "Ab3xK9pQ", after(5_000)).ok).toBe(false);
    expect(tokens.verify(`${payload}`, "Ab3xK9pQ", after(5_000))).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("issues a unique nonce every time", () => {
    expect(tokens.issue("Ab3xK9pQ", t0)).not.toBe(tokens.issue("Ab3xK9pQ", t0));
  });
});

describe("isBotUserAgent", () => {
  it.each([
    "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; RMX3363 Build/TP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]",
  ])("allows real browsers incl. the Facebook in-app browser: %s", (ua) => {
    expect(isBotUserAgent(ua)).toBe(false);
  });
});

describe("suspicionReason", () => {
  const base = {
    shareLinkId: undefined as never,
    counted: 10,
    blocked: 0,
    countedLastHour: 0,
    topSubnetCounted: 2,
  };
  it("ignores normal links", async () => {
    const { suspicionReason } =
      await import("../../src/modules/admin/moderation/moderation.service.js");
    expect(suspicionReason(base)).toBeNull();
    expect(suspicionReason({ ...base, counted: 10, topSubnetCounted: 10 })).toBeNull(); // too small to judge
  });
  it("flags blocked-attempt storms, bursts and single-network concentration", async () => {
    const { suspicionReason } =
      await import("../../src/modules/admin/moderation/moderation.service.js");
    expect(suspicionReason({ ...base, blocked: 25 })).toMatch(/blocked/);
    expect(suspicionReason({ ...base, countedLastHour: 30 })).toMatch(/spike/);
    expect(suspicionReason({ ...base, counted: 20, topSubnetCounted: 13 })).toMatch(/one network/);
  });
});
