import { Router, type Request } from "express";
import type { RouterConfig } from "../../routes/routerConfig.js";
import type { AuthMiddleware } from "../../middlewares/auth.js";
import { createRateLimiter } from "../../middlewares/rateLimiter.js";
import { validate } from "../../middlewares/validate.js";
import type { ShareLinkController } from "./shareLink.controller.js";
import { getOrCreateLinkSchema, recordShareSchema } from "./shareLink.schema.js";

const byParticipant = (req: Request) => req.participant?.participantId ?? req.ip ?? "unknown";

/** Participant-only routes, mounted at /v1. Limiters run after auth so they key by participant. */
export function createShareLinkRouter(
  controller: ShareLinkController,
  auth: AuthMiddleware,
  config: RouterConfig,
): Router {
  const router = Router();

  const linkLimiter = createRateLimiter({
    name: "share-link",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: 60 * 60 * 1000,
    limit: 20,
    keyGenerator: byParticipant,
  });
  const shareLimiter = createRateLimiter({
    name: "track-share",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: byParticipant,
  });

  router.put(
    "/campaigns/:id/link",
    auth.requireParticipant,
    linkLimiter,
    validate(getOrCreateLinkSchema),
    controller.getOrCreate,
  );
  router.post(
    "/track/share",
    auth.requireParticipant,
    shareLimiter,
    validate(recordShareSchema),
    controller.recordShare,
  );
  router.get("/me/activity", auth.requireParticipant, controller.activity);

  return router;
}
