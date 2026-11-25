import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    // Integration tests share one in-memory MongoDB per file; run files serially for stability.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 120000,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      MONGODB_URI: "mongodb://127.0.0.1:27017/placeholder",
      CORS_ORIGINS: "http://localhost:3000",
      RATE_LIMIT_ENABLED: "false",
      SESSION_SECRET: "test-secret-test-secret-test-secret-1234",
      PUBLIC_SITE_URL: "https://offer-finder.com",
      OPEN_TOKEN_SECRET: "test-open-token-secret-test-open-token-secret",
      FINGERPRINT_SALT: "test-fingerprint-salt",
      ADMIN_SESSION_SECRET: "test-admin-secret-test-admin-secret-1234",
      PUBLIC_UPLOAD_BASE_URL: "http://api.test/uploads",
    },
  },
});
