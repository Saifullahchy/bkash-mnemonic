import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import type { CampaignController } from "./campaign.controller.js";
import { getCampaignSchema } from "./campaign.schema.js";

/** Public campaign routes, mounted at /v1/campaigns. */
export function createCampaignRouter(controller: CampaignController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.get("/:id", validate(getCampaignSchema), controller.getById);
  return router;
}
