import type { ClientRateLimitInfo, Store } from "express-rate-limit";
import { createClient, type RedisClientType } from "redis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { redisRateLimitStore } from "../../src/middlewares/rateLimiter.js";
import type { RateLimitStoreFactory } from "../../src/routes/routerConfig.js";
import { testApp } from "../helpers/testApp.js";

/** Stand-in for Redis: every store object reads/writes the same counters, like two API instances. */
function sharedStore(): RateLimitStoreFactory {
  const hits = new Map<string, number>();
  return (name) =>
    ({
      prefix: name,
      localKeys: false,
      increment(key: string): Promise<ClientRateLimitInfo> {
        const total = (hits.get(`${name}:${key}`) ?? 0) + 1;
        hits.set(`${name}:${key}`, total);
        return Promise.resolve({ totalHits: total, resetTime: new Date(Date.now() + 60_000) });
      },
      decrement(key: string) {
        hits.set(`${name}:${key}`, (hits.get(`${name}:${key}`) ?? 1) - 1);
        return Promise.resolve();
      },
      resetKey(key: string) {
        hits.delete(`${name}:${key}`);
        return Promise.resolve();
      },
    }) satisfies Store;
}

const brokenStore: RateLimitStoreFactory = (name) =>
  ({
    prefix: name,
    increment(): Promise<ClientRateLimitInfo> {
      return Promise.reject(new Error("ECONNREFUSED"));
    },
    async decrement() {},
    async resetKey() {},
  }) satisfies Store;

async function loginsUntilBlocked(apps: ReturnType<typeof testApp>[], phone: string) {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const res = await apps[i % apps.length]!.post("/v1/auth/phone").send({ phone });
    statuses.push(res.status);
  }
  return statuses;
}

describe("rate limits across API instances", () => {
  it("shares one budget between instances that use the same store", async () => {
    const store = sharedStore();
    const a = testApp({ rateLimitEnabled: true, rateLimitStore: store });
    const b = testApp({ rateLimitEnabled: true, rateLimitStore: store });
    // 5 logins per number are allowed in total, alternating between the two instances.
    expect(await loginsUntilBlocked([a, b], "01712345678")).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("fails open (requests still work) when the store is unreachable", async () => {
    const app = testApp({ rateLimitEnabled: true, rateLimitStore: brokenStore });
    expect(await loginsUntilBlocked([app], "01712345678")).toEqual([200, 200, 200, 200, 200, 200]);
    await app.get("/v1/campaigns").expect(200);
  });
});

// Runs against a real Redis when one is available (TEST_REDIS_URL=redis://localhost:6379).
const redisUrl = process.env.TEST_REDIS_URL;
describe.skipIf(!redisUrl)("Redis rate-limit store", () => {
  let client: RedisClientType;
  beforeAll(async () => {
    client = createClient({ url: redisUrl, database: 15 });
    await client.connect();
    await client.flushDb();
  });
  afterAll(async () => {
    await client.flushDb();
    await client.close();
  });

  it("enforces the limit across two instances through Redis", async () => {
    const store = redisRateLimitStore(client);
    const a = testApp({ rateLimitEnabled: true, rateLimitStore: store });
    const b = testApp({ rateLimitEnabled: true, rateLimitStore: store });
    expect(await loginsUntilBlocked([a, b], "01812345678")).toEqual([200, 200, 200, 200, 200, 429]);
    expect(await client.keys("rl:auth-phone*")).not.toHaveLength(0);
  });
});
