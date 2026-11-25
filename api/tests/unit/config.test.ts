import { describe, expect, it } from "vitest";
import { env, productionConfigIssues, type Env } from "../../src/config/env.js";

const safeProduction: Env = {
  ...env,
  NODE_ENV: "production",
  CORS_ORIGINS: ["https://offer-finder.com", "https://admin.offer-finder.com"],
  PUBLIC_SITE_URL: "https://offer-finder.com",
  PUBLIC_UPLOAD_BASE_URL: "https://cdn.offer-finder.com/uploads",
  RATE_LIMIT_ENABLED: true,
  TRUST_PROXY: 1,
  REDIS_URL: "rediss://cache.internal:6379",
  SMTP_URL: "smtps://user:pass@smtp.example.com",
  PROXY_SECRET: "proxy-secret-proxy-secret-proxy-secret",
  COOKIE_SECURE: undefined,
  SEED_ADMIN_PASSWORD: undefined,
};

describe("productionConfigIssues", () => {
  it("accepts a safe production configuration", () => {
    expect(productionConfigIssues(safeProduction)).toEqual({ errors: [], warnings: [] });
  });

  it("never applies outside production", () => {
    expect(
      productionConfigIssues({
        ...safeProduction,
        NODE_ENV: "development",
        RATE_LIMIT_ENABLED: false,
      }).errors,
    ).toEqual([]);
  });

  it("blocks localhost/http origins, shared secrets, insecure cookies and disabled rate limits", () => {
    const { errors } = productionConfigIssues({
      ...safeProduction,
      CORS_ORIGINS: ["http://localhost:3000"],
      PUBLIC_SITE_URL: "http://offer-finder.com",
      ADMIN_SESSION_SECRET: safeProduction.SESSION_SECRET,
      COOKIE_SECURE: false,
      RATE_LIMIT_ENABLED: false,
    });
    expect(errors).toHaveLength(5);
  });

  it("warns about settings that only matter at scale or behind a proxy", () => {
    const { errors, warnings } = productionConfigIssues({
      ...safeProduction,
      TRUST_PROXY: 0,
      REDIS_URL: undefined,
      SMTP_URL: undefined,
    });
    expect(errors).toEqual([]);
    expect(warnings.join("\n")).toMatch(/TRUST_PROXY[\s\S]*REDIS_URL[\s\S]*SMTP_URL/);
  });
});
