import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../../core/http/apiResponse.js";
import { setNoStore } from "../../../core/http/cache.js";
import { currentAdmin, type AdminAuthMiddleware } from "../../../middlewares/adminAuth.js";
import { validate, validated } from "../../../middlewares/validate.js";
import type { ContentService } from "../../content/content.service.js";

export const saveTermsSchema = {
  body: z
    .object({
      title: z.string().trim().min(1, "Pop-up title is required").max(120),
      summary: z
        .string()
        .trim()
        .min(1, "Home page summary is required")
        .max(160, "Keep the summary under 160 characters"),
      html: z.string().max(50_000, "Terms are too long"),
      baseVersion: z.number().int().min(1).nullable(),
    })
    .strict(),
};
export const restoreTermsSchema = { body: z.object({ version: z.number().int().min(1) }).strict() };

const actorOf = (req: Request) => {
  const admin = currentAdmin(req);
  return { kind: "admin" as const, id: admin.id, label: admin.name };
};

export class AdminContentController {
  constructor(private readonly service: ContentService) {}

  getTerms = async (_req: Request, res: Response): Promise<void> => {
    setNoStore(res);
    sendSuccess(res, await this.service.getTermsForAdmin());
  };

  saveTerms = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, saveTermsSchema);
    sendSuccess(res, await this.service.saveTerms(body, actorOf(req)));
  };

  restoreTerms = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, restoreTermsSchema);
    sendSuccess(res, await this.service.restoreTerms(body.version, actorOf(req)));
  };
}

/** Mounted at /v1/admin/content. */
export function createAdminContentRouter(
  controller: AdminContentController,
  auth: AdminAuthMiddleware,
): Router {
  const router = Router();
  router.get("/terms", controller.getTerms);
  router.put("/terms", auth.requireRole("admin"), validate(saveTermsSchema), controller.saveTerms);
  router.post(
    "/terms/restore",
    auth.requireRole("admin"),
    validate(restoreTermsSchema),
    controller.restoreTerms,
  );
  return router;
}
