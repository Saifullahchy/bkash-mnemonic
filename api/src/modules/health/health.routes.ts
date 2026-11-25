import { Router } from "express";
import { isDatabaseReady } from "../../config/db.js";
import { getRedis, isRedisReady } from "../../config/redis.js";
import { sendError, sendSuccess } from "../../core/http/apiResponse.js";

/**
 * Probes for the orchestrator / load balancer:
 *  - /health (liveness): the process is up — never touches dependencies.
 *  - /ready  (readiness): dependencies are reachable — take out of rotation if not.
 */
export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    sendSuccess(res, { status: "ok", uptimeSeconds: Math.round(process.uptime()) });
  });

  // Redis is reported but does not fail readiness: rate limiters fail open without it.
  router.get("/ready", (_req, res) => {
    const redis = getRedis() ? (isRedisReady() ? "up" : "down") : "not-configured";
    if (isDatabaseReady()) {
      sendSuccess(res, { status: "ready", database: "up", redis });
      return;
    }
    sendError(res, 503, { code: "NOT_READY", message: "Database is not connected" });
  });

  return router;
}
