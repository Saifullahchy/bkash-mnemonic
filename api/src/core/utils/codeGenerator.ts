import { randomInt } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Cryptographically random, unbiased base62 string. 8 chars ≈ 47.6 bits
 * (2.18e14 combinations), so share codes cannot be enumerated or guessed.
 */
export function randomBase62(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) code += BASE62[randomInt(BASE62.length)];
  return code;
}

export const SHARE_CODE_LENGTH = 8;
