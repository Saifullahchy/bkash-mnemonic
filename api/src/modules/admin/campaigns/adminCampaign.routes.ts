import { Router } from "express";
import type { AdminAuthMiddleware } from "../../../middlewares/adminAuth.js";
import { singleImageUpload } from "../../../middlewares/upload.js";
import { validate } from "../../../middlewares/validate.js";
import type { AdminCampaignController } from "./adminCampaign.controller.js";
import {
  campaignIdSchema,
  createCampaignSchema,
  listCampaignsSchema,
  setActiveSchema,
  updateCampaignSchema,
  uploadMediaSchema,
} from "./adminCampaign.schema.js";
import { MAX_UPLOAD_BYTES } from "./adminCampaign.service.js";

/**
 * Mounted at /v1/admin/campaigns behind requireAdmin.
 * Both roles can read; only "admin" can change anything ("support" is read-only).
 */
export function createAdminCampaignRouter(
  controller: AdminCampaignController,
  auth: AdminAuthMiddleware,
): Router {
  const router = Router();
  const canWrite = auth.requireRole("admin");

  router.get("/", validate(listCampaignsSchema), controller.list);
  router.get("/:id", validate(campaignIdSchema), controller.get);

  router.post("/", canWrite, validate(createCampaignSchema), controller.create);
  router.patch("/:id", canWrite, validate(updateCampaignSchema), controller.update);
  router.post("/:id/publish", canWrite, validate(campaignIdSchema), controller.publish);
  router.post("/:id/unpublish", canWrite, validate(campaignIdSchema), controller.unpublish);
  router.patch("/:id/active", canWrite, validate(setActiveSchema), controller.setActive);
  router.delete("/:id", canWrite, validate(campaignIdSchema), controller.remove);
  router.post(
    "/:id/media/:kind",
    canWrite,
    singleImageUpload(MAX_UPLOAD_BYTES),
    validate(uploadMediaSchema),
    controller.uploadMedia,
  );

  return router;
}
