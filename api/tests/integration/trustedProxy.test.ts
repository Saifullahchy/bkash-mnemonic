import { describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";
import { testApp } from "../helpers/testApp.js";

const SECRET = "proxy-secret-proxy-secret-proxy-secret";
const remaining = (res: { headers: Record<string, string> }) =>
  Number(/r=(\d+)/.exec(res.headers.ratelimit ?? "")?.[1]);

describe("trusted web/admin servers", () => {
  const get = (app: ReturnType<typeof testApp>, headers: Record<string, string>) =>
    app.get("/v1/campaigns").set(headers).expect(200);

  it("limits each visitor separately when the secret matches", async () => {
    const app = testApp({ rateLimitEnabled: true, proxySecret: SECRET });
    const from = (ip: string) => ({ "X-Proxy-Secret": SECRET, "X-Client-IP": ip });
    expect(remaining(await get(app, from("203.0.113.1")))).toBe(env.RATE_LIMIT_MAX - 1);
    expect(remaining(await get(app, from("203.0.113.1")))).toBe(env.RATE_LIMIT_MAX - 2);
    expect(remaining(await get(app, from("203.0.113.2")))).toBe(env.RATE_LIMIT_MAX - 1);
  });

  it("ignores a claimed IP with a wrong, missing or unconfigured secret", async () => {
    const app = testApp({ rateLimitEnabled: true, proxySecret: SECRET });
    await get(app, { "X-Proxy-Secret": "wrong", "X-Client-IP": "203.0.113.1" });
    const second = await get(app, { "X-Client-IP": "203.0.113.2" });
    expect(remaining(second)).toBe(env.RATE_LIMIT_MAX - 2); // same bucket: the connection's IP

    const open = testApp({ rateLimitEnabled: true });
    await get(open, { "X-Proxy-Secret": "", "X-Client-IP": "203.0.113.1" });
    const other = await get(open, { "X-Proxy-Secret": SECRET, "X-Client-IP": "203.0.113.2" });
    expect(remaining(other)).toBe(env.RATE_LIMIT_MAX - 2);
  });

  it("does not count page renders made by our own server", async () => {
    const app = testApp({ rateLimitEnabled: true, proxySecret: SECRET });
    const res = await get(app, { "X-Proxy-Secret": SECRET });
    expect(res.headers.ratelimit).toBeUndefined();
  });

  it("falls back to the connection's IP when the claimed IP is malformed", async () => {
    const app = testApp({ rateLimitEnabled: true, proxySecret: SECRET });
    await get(app, { "X-Proxy-Secret": SECRET, "X-Client-IP": "not-an-ip" });
    expect(remaining(await get(app, {}))).toBe(env.RATE_LIMIT_MAX - 2);
  });
});
