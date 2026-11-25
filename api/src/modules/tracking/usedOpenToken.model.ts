import { Schema, model } from "mongoose";
import { OPEN_TOKEN_MAX_AGE_MS } from "../../core/security/openTokens.js";

export interface UsedOpenToken {
  nonce: string;
  createdAt: Date;
}

/**
 * Nonces of redeemed open tokens. The unique index makes redemption atomic
 * across all API instances; TTL deletes entries once the token could no
 * longer be valid anyway.
 */
const usedOpenTokenSchema = new Schema<UsedOpenToken>({
  nonce: { type: String, required: true },
  createdAt: { type: Date, required: true },
});

usedOpenTokenSchema.index({ nonce: 1 }, { unique: true });
usedOpenTokenSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: Math.ceil((OPEN_TOKEN_MAX_AGE_MS * 2) / 1000) },
);

export const UsedOpenTokenModel = model<UsedOpenToken>("UsedOpenToken", usedOpenTokenSchema);
