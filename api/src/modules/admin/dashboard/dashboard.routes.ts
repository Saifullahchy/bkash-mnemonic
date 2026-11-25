import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../../core/http/apiResponse.js";
import { setNoStore } from "../../../core/http/cache.js";
import { validate, validated } from "../../../middlewares/validate.js";
import type { DashboardService } from "./dashboard.service.js";

export const dashboardSchema = {
  query: z
    .object({
      range: z.enum(["7d", "30d"]).default("7d"),
      chart: z.enum(["7d", "30d", "all"]).default("7d"),
    })
    .strict(),
};

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  get = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, dashboardSchema);
    setNoStore(res);
    sendSuccess(res, await this.service.get(query.range, query.chart));
  };
}

/** Mounted at /v1/admin/dashboard (read-only, all admin roles). */
export function createDashboardRouter(controller: DashboardController): Router {
  const router = Router();
  router.get("/", validate(dashboardSchema), controller.get);
  return router;
}
