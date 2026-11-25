import { Router } from "express";
import { env } from "../config/env.js";
import type { Container } from "../container.js";
import { createRateLimiter } from "../middlewares/rateLimiter.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import { createCampaignRouter } from "../modules/campaign/campaign.routes.js";
import { createContentRouter } from "../modules/content/content.routes.js";
import { createShareLinkRouter } from "../modules/shareLink/shareLink.routes.js";
import { createStatsRouter } from "../modules/stats/stats.routes.js";
import { createTrackingRouter } from "../modules/tracking/tracking.routes.js";
import { createAdminRouter } from "./admin.js";

/** Version 1 of the API: public + participant routes, and the admin API under /v1/admin. */
export function createV1Router(container: Container): Router {
  const { controllers, middleware, config } = container;
  const router = Router();

  // Coarse per-IP ceiling for everything; stricter per-route limiters live in each module.
  router.use(
    createRateLimiter({
      name: "global",
      enabled: config.rateLimitEnabled,
      store: config.rateLimitStore,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      limit: env.RATE_LIMIT_MAX,
      // Page renders by our own web server: one address for every visitor.
      skip: (req) => req.internal === true,
    }),
  );

  router.use("/admin", createAdminRouter(container));
  router.use("/auth", createAuthRouter(controllers.auth, middleware, config));
  router.use("/campaigns", createCampaignRouter(controllers.campaign));
  router.use("/stats", createStatsRouter(controllers.stats));
  router.use("/content", createContentRouter(controllers.content));
  router.use(createShareLinkRouter(controllers.shareLink, middleware.auth, config));
  router.use(createTrackingRouter(controllers.tracking, middleware, config));

  return router;
}
