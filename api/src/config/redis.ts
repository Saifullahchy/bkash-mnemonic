import { createClient, type RedisClientType } from "redis";
import { logger } from "./logger.js";

let client: RedisClientType | undefined;

/**
 * Optional shared Redis (rate-limit counters across API instances).
 * Commands fail fast while disconnected (no offline queue), so a Redis outage
 * never stalls requests — rate limiters fail open and the DB-backed counting
 * rules (dedup, caps) keep protecting the business logic.
 */
export async function connectRedis(url: string): Promise<RedisClientType> {
  client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
    },
  });
  client.on("error", (error: Error) => logger.error({ err: error }, "Redis error"));
  client.on("ready", () => logger.info("Redis connected"));
  await client.connect();
  return client;
}

export function getRedis(): RedisClientType | undefined {
  return client;
}

export function isRedisReady(): boolean {
  return client?.isReady ?? false;
}

export async function disconnectRedis(): Promise<void> {
  if (client?.isOpen) await client.close();
  client = undefined;
}
