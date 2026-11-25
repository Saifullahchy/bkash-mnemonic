import { Router } from "express";
import type { Container } from "../container.js";
import { createAdminAuthRouter } from "../modules/admin/auth/adminAuth.routes.js";
import { createAdminCampaignRouter } from "../modules/admin/campaigns/adminCampaign.routes.js";
import { createAdminContentRouter } from "../modules/admin/content/adminContent.routes.js";
import { createExportsRouter } from "../modules/admin/exports/exports.routes.js";
import { createDashboardRouter } from "../modules/admin/dashboard/dashboard.routes.js";
import { createLeaderboardRouter } from "../modules/admin/leaderboard/leaderboard.routes.js";
import { createParticipantsRouter } from "../modules/admin/participants/participants.routes.js";

/**
 * Admin API for admin.offer-finder.com, mounted at /v1/admin.
 * Everything except login/logout requires an active admin session.
 */
export function createAdminRouter({ controllers, middleware, config }: Container): Router {
  const router = Router();
  router.use("/auth", createAdminAuthRouter(controllers.adminAuth, middleware.adminAuth, config));

  router.use(middleware.adminAuth.requireAdmin);
  router.use("/dashboard", createDashboardRouter(controllers.dashboard));
  router.use("/campaigns", createLeaderboardRouter(controllers.leaderboard, middleware.adminAuth));
  router.use(
    "/campaigns",
    createAdminCampaignRouter(controllers.adminCampaigns, middleware.adminAuth),
  );
  router.use("/content", createAdminContentRouter(controllers.adminContent, middleware.adminAuth));
  router.use("/exports", createExportsRouter(controllers.exports, middleware.adminAuth, config));
  router.use(createParticipantsRouter(controllers.participants, middleware.adminAuth));
  return router;
}
