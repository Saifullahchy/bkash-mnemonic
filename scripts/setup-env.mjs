#!/usr/bin/env node
/**
 * Creates the local env files with freshly generated secrets. Existing files are never changed.
 *
 *   node scripts/setup-env.mjs            create api/.env, web/.env.local, admin/.env.local
 *   node scripts/setup-env.mjs --print    only print new secret values (e.g. for a hosting dashboard)
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const random = (bytes) => randomBytes(bytes).toString("base64url");

const proxySecret = random(48);
const apiSecrets = {
  SESSION_SECRET: random(48),
  ADMIN_SESSION_SECRET: random(48),
  OPEN_TOKEN_SECRET: random(48),
  FINGERPRINT_SALT: random(32),
  PROXY_SECRET: proxySecret,
};

if (process.argv.includes("--print")) {
  for (const [key, value] of Object.entries(apiSecrets))
    console.log(`${key}=${value}`);
  process.exit(0);
}

const files = [
  [
    "api/.env",
    "api/.env.example",
    { ...apiSecrets, SEED_ADMIN_PASSWORD: random(15) },
  ],
  ["web/.env.local", "web/.env.example", { PROXY_SECRET: proxySecret }],
  ["admin/.env.local", "admin/.env.example", { PROXY_SECRET: proxySecret }],
];

// All or nothing: the three files share PROXY_SECRET, so a partial set would not match.
const existing = files
  .map(([target]) => target)
  .filter((target) => existsSync(join(root, target)));
if (existing.length > 0) {
  console.error(`Already there: ${existing.join(", ")}. Nothing was changed.`);
  console.error("Edit them by hand, or rename them and run this again.");
  process.exit(1);
}

for (const [target, example, values] of files) {
  let text = readFileSync(join(root, example), "utf8");
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${key}=.*$`, "m");
    if (!line.test(text)) throw new Error(`${key} is missing from ${example}`);
    text = text.replace(line, `${key}=${value}`);
  }
  writeFileSync(join(root, target), text, { mode: 0o600 });
  console.log(`created ${target}`);
}
console.log("\nNext: add IMAGEKIT_PRIVATE_KEY to api/.env (optional locally).");
console.log(
  "The seeded admin's login is SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in api/.env.",
);
