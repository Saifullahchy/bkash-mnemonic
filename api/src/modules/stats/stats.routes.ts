import { Router } from "express";
import type { StatsController } from "./stats.controller.js";

/** Mounted at /v1/stats. */
export function createStatsRouter(controller: StatsController): Router {
  const router = Router();
  router.get("/public", controller.getPublic);
  return router;
}
