import { Router } from "express";
import type { AdminAuthMiddleware } from "../../../middlewares/adminAuth.js";
import { createRateLimiter } from "../../../middlewares/rateLimiter.js";
import { validate } from "../../../middlewares/validate.js";
import type { RouterConfig } from "../../../routes/routerConfig.js";
import { adminLoginSchema, type AdminAuthController } from "./adminAuth.controller.js";

/** Mounted at /v1/admin/auth. */
export function createAdminAuthRouter(
  controller: AdminAuthController,
  auth: AdminAuthMiddleware,
  config: RouterConfig,
): Router {
  const router = Router();

  // Only failed attempts count, so a team behind one office IP isn't locked out
  // by normal use; per-account lockout (10 failures) is enforced in the service.
  const failedLoginsPerIp = createRateLimiter({
    name: "admin-login-ip",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: 15 * 60_000,
    limit: 5,
    skipSuccessfulRequests: true,
  });

  router.post("/login", failedLoginsPerIp, validate(adminLoginSchema), controller.login);
  router.post("/logout", controller.logout);
  router.get("/me", auth.requireAdmin, controller.me);
  return router;
}
