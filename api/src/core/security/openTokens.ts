import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** A real visitor must have the page open at least this long before an open counts. */
export const OPEN_TOKEN_MIN_AGE_MS = 2_000;
/** Tokens expire so harvested ones can't be stockpiled. */
export const OPEN_TOKEN_MAX_AGE_MS = 10 * 60_000;

export interface OpenTokenClaims {
  code: string;
  nonce: string;
  issuedAt: number;
}

export type OpenTokenCheck =
  | { ok: true; claims: OpenTokenClaims }
  | { ok: false; reason: "malformed" | "bad_signature" | "wrong_code" | "too_early" | "expired" };

/**
 * Short-lived proof that the share landing page was actually rendered:
 *   base64url(code.nonce.issuedAt) + "." + HMAC-SHA256
 * Issued when the page renders, redeemed by the page's beacon. The nonce is
 * consumed on redemption (single use), enforced atomically in MongoDB.
 */
export class OpenTokens {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = Buffer.from(secret, "utf8");
  }

  issue(code: string, now: Date): string {
    const nonce = randomBytes(16).toString("base64url");
    const payload = Buffer.from(`${code}.${nonce}.${now.getTime()}`).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  verify(token: string, expectedCode: string, now: Date): OpenTokenCheck {
    const [payload, signature, ...rest] = token.split(".");
    if (!payload || !signature || rest.length > 0) return { ok: false, reason: "malformed" };

    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return { ok: false, reason: "bad_signature" };
    }

    const [code, nonce, issuedAtRaw] = Buffer.from(payload, "base64url")
      .toString("utf8")
      .split(".");
    const issuedAt = Number(issuedAtRaw);
    if (!code || !nonce || !Number.isFinite(issuedAt)) return { ok: false, reason: "malformed" };
    if (code !== expectedCode) return { ok: false, reason: "wrong_code" };

    const age = now.getTime() - issuedAt;
    if (age < OPEN_TOKEN_MIN_AGE_MS) return { ok: false, reason: "too_early" };
    if (age > OPEN_TOKEN_MAX_AGE_MS) return { ok: false, reason: "expired" };

    return { ok: true, claims: { code, nonce, issuedAt } };
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.key).update(payload).digest("base64url");
  }
}
