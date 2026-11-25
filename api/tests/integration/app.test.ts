import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../../src/middlewares/errorHandler.js";
import { httpLogger } from "../../src/middlewares/httpLogger.js";
import { createRateLimiter } from "../../src/middlewares/rateLimiter.js";
import { testApp } from "../helpers/testApp.js";

describe("cross-cutting HTTP behaviour", () => {
  it("serves liveness and readiness probes", async () => {
    await testApp().get("/health").expect(200);
    const ready = await testApp().get("/ready").expect(200);
    expect(ready.body.data.database).toBe("up");
  });

  it("returns unknown routes as a 404 envelope with a request id", async () => {
    const res = await testApp().get("/v1/nope").expect(404);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: "NOT_FOUND", requestId: expect.any(String) },
    });
    expect(res.headers["x-request-id"]).toBe(res.body.error.requestId);
  });

  it("reuses a well-formed upstream request id but replaces a malicious one", async () => {
    const good = await testApp().get("/health").set("X-Request-Id", "lb-abc12345");
    expect(good.headers["x-request-id"]).toBe("lb-abc12345");

    const bad = await testApp().get("/health").set("X-Request-Id", "<script>alert(1)</script>");
    expect(bad.headers["x-request-id"]).not.toContain("<");
  });

  it("allows CORS (with credentials) only for configured origins", async () => {
    const allowed = await testApp().get("/health").set("Origin", "http://localhost:3000");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await testApp().get("/health").set("Origin", "https://evil.example");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sends security headers and hides the framework", async () => {
    const res = await testApp().get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("rejects malformed JSON bodies with a 400", async () => {
    const res = await testApp()
      .post("/v1/campaigns")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});

describe("createRateLimiter", () => {
  const appWithLimit = (limit: number) => {
    const app = express();
    app.use(httpLogger);
    app.use(createRateLimiter({ name: "test", windowMs: 60_000, limit }));
    app.get("/", (_req, res) => {
      res.json({ ok: true });
    });
    app.use(errorHandler);
    return supertest(app);
  };

  it("returns a 429 envelope with standard headers once the limit is exceeded", async () => {
    const client = appWithLimit(2);
    await client.get("/").expect(200);
    await client.get("/").expect(200);
    const res = await client.get("/").expect(429);

    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(res.headers["ratelimit-policy"]).toBeDefined();
  });

  it("is a no-op when disabled", async () => {
    const app = express();
    app.use(createRateLimiter({ name: "off", windowMs: 60_000, limit: 1, enabled: false }));
    app.get("/", (_req, res) => {
      res.json({ ok: true });
    });
    const client = supertest(app);
    await client.get("/").expect(200);
    await client.get("/").expect(200);
  });
});

describe("uploaded files", () => {
  it("returns a 404 envelope (not 500) for a missing upload", async () => {
    const res = await testApp().get("/uploads/campaigns/nope/banner-missing.png").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
