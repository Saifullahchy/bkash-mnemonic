import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { buildContainer } from "../../src/container.js";
import type { FileStorage } from "../../src/core/storage/fileStorage.js";
import type { RateLimitStoreFactory } from "../../src/routes/routerConfig.js";
import { fixedClock } from "../../src/core/utils/clock.js";
import { NOW } from "./factories.js";

interface TestAppOptions {
  now?: Date;
  rateLimitEnabled?: boolean;
  /** 1 = trust X-Forwarded-For, so tests can simulate client IPs. */
  trustProxy?: number;
  proxySecret?: string;
  storage?: FileStorage;
  /** Shared rate-limit store (simulates several API instances behind one Redis). */
  rateLimitStore?: RateLimitStoreFactory;
}

/** The real app wired with a fixed clock so date-based rules are deterministic. */
export function testApp(nowOrOptions: Date | TestAppOptions = {}) {
  const options = nowOrOptions instanceof Date ? { now: nowOrOptions } : nowOrOptions;
  return supertest(
    createApp(
      buildContainer({
        clock: fixedClock(options.now ?? NOW),
        rateLimitEnabled: options.rateLimitEnabled ?? false,
        trustProxy: options.trustProxy ?? 0,
        ...(options.proxySecret ? { proxySecret: options.proxySecret } : {}),
        ...(options.storage ? { storage: options.storage } : {}),
        ...(options.rateLimitStore ? { rateLimitStore: options.rateLimitStore } : {}),
      }),
    ),
  );
}

/** Logs a phone number in and returns the session cookie to send on later requests. */
export async function loginAs(
  phone = "01712345678",
  app = testApp(),
  extraCookie?: string,
): Promise<{ cookie: string; participantId: string }> {
  const req = app.post("/v1/auth/phone").send({ phone });
  if (extraCookie) void req.set("Cookie", extraCookie);
  const res = await req.expect(200);
  const setCookie = res.headers["set-cookie"] as unknown as string[];
  const session = setCookie.find((c) => c.startsWith("of_session="));
  if (!session) throw new Error("No session cookie set");
  return { cookie: session.split(";")[0]!, participantId: res.body.data.participant.id as string };
}
