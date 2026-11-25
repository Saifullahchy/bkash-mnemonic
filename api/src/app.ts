import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { env, isProduction } from "./config/env.js";
import { buildContainer, type Container } from "./container.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { httpLogger } from "./middlewares/httpLogger.js";
import { corsPolicy, securityHeaders } from "./middlewares/security.js";
import { trustedProxy } from "./middlewares/trustedProxy.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createV1Router } from "./routes/v1.js";

/**
 * Builds the Express app without starting a server or opening a DB connection,
 * so tests can mount it with supertest and their own container.
 * Express 5 forwards rejected promises from async handlers to errorHandler.
 */
export function createApp(container: Container = buildContainer()): Express {
  const app = express();

  // Correct req.ip behind N proxies (load balancer / CDN) — rate limits depend on it.
  app.set("trust proxy", container.config.trustProxy);
  app.set("query parser", "simple");
  app.disable("x-powered-by");

  app.use(httpLogger);
  app.use(trustedProxy(container.config.proxySecret));
  app.use(securityHeaders);
  app.use(corsPolicy(env.CORS_ORIGINS));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use(createHealthRouter());
  if (env.STORAGE_DRIVER === "local" || !isProduction) {
    // Images uploaded to local disk (kept in development after switching to ImageKit, so
    // campaigns that still point at /uploads keep working until `npm run images:migrate`).
    // Keys are unique per upload, so cache them forever.
    app.use(
      "/uploads",
      express.static(env.UPLOAD_DIR, {
        immutable: true,
        maxAge: "365d",
        index: false,
        dotfiles: "deny",
        fallthrough: false,
      }),
    );
  }
  app.use("/v1", createV1Router(container));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
