import { Router, type RequestHandler } from "express";
import type { RouterConfig } from "../../routes/routerConfig.js";
import { normalizeBdPhone } from "../../core/utils/phone.js";
import type { AuthMiddleware } from "../../middlewares/auth.js";
import { createRateLimiter } from "../../middlewares/rateLimiter.js";
import { validate } from "../../middlewares/validate.js";
import type { AuthController } from "./auth.controller.js";
import { phoneLoginSchema } from "./auth.schema.js";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Mounted at /v1/auth. */
export function createAuthRouter(
  controller: AuthController,
  middleware: { auth: AuthMiddleware; visitor: RequestHandler },
  config: RouterConfig,
): Router {
  const router = Router();

  // Per IP: generous enough for carrier-grade NAT (many phones share one IP in BD).
  const loginPerIp = createRateLimiter({
    name: "auth-phone-ip",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: FIFTEEN_MINUTES,
    limit: 20,
  });
  // Per phone number: stops hammering one number (and future OTP SMS cost).
  const loginPerPhone = createRateLimiter({
    name: "auth-phone-number",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: FIFTEEN_MINUTES,
    limit: 5,
    keyGenerator: (req) => {
      const phone: unknown = (req.body as { phone?: unknown } | undefined)?.phone;
      return typeof phone === "string" ? normalizeBdPhone(phone) : "invalid";
    },
  });

  router.post(
    "/phone",
    loginPerIp,
    loginPerPhone,
    validate(phoneLoginSchema),
    middleware.visitor,
    controller.loginWithPhone,
  );
  router.post("/logout", controller.logout);
  router.get("/session", middleware.auth.optionalParticipant, controller.session);

  return router;
}
