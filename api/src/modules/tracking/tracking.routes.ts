import { Router, type RequestHandler } from "express";
import { sendSuccess } from "../../core/http/apiResponse.js";
import type { AuthMiddleware } from "../../middlewares/auth.js";
import { ignoreBots } from "../../middlewares/ignoreBots.js";
import { createRateLimiter } from "../../middlewares/rateLimiter.js";
import { validate } from "../../middlewares/validate.js";
import type { RouterConfig } from "../../routes/routerConfig.js";
import type { TrackingController } from "./tracking.controller.js";
import { getLandingSchema, recordOpenSchema } from "./tracking.schema.js";

const HOUR = 60 * 60 * 1000;

/** Over the limit → looks like a normal "not counted" (no signal to tune against). */
const silentlyNotCounted: RequestHandler = (req, res) => {
  req.log.warn({ reason: "rate_limited" }, "link open rate limited");
  sendSuccess(res, { counted: false }, { status: 202 });
};

/** Mounted at /v1. */
export function createTrackingRouter(
  controller: TrackingController,
  middleware: { auth: AuthMiddleware; visitor: RequestHandler },
  config: RouterConfig,
): Router {
  const router = Router();

  // Per IP: generous for carrier-grade NAT (thousands of phones can share one IP).
  const opensPerIp = createRateLimiter({
    name: "track-open-ip",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: HOUR,
    limit: 120,
    onLimited: silentlyNotCounted,
  });
  // Per browser: a real person opens a handful of friends' links, not dozens.
  const opensPerVisitor = createRateLimiter({
    name: "track-open-visitor",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: HOUR,
    limit: 10,
    keyGenerator: (req) => req.visitor?.id ?? req.ip ?? "unknown",
    onLimited: silentlyNotCounted,
  });

  router.get("/share/:code", validate(getLandingSchema), controller.landing);
  router.post(
    "/track/open",
    ignoreBots,
    opensPerIp,
    middleware.visitor,
    opensPerVisitor,
    middleware.auth.optionalParticipant,
    validate(recordOpenSchema),
    controller.recordOpen,
  );

  return router;
}
