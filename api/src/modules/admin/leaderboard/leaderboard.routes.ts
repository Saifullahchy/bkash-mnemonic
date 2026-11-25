import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../../core/http/apiResponse.js";
import { setNoStore } from "../../../core/http/cache.js";
import { objectIdSchema } from "../../../core/http/schemas.js";
import { currentAdmin, type AdminAuthMiddleware } from "../../../middlewares/adminAuth.js";
import { validate, validated } from "../../../middlewares/validate.js";
import type { LeaderboardService } from "./leaderboard.service.js";

export const leaderboardSchema = {
  params: z.object({ id: objectIdSchema }),
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().trim().max(20).optional(),
    })
    .strict(),
};

export const announceSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({ force: z.boolean().default(false) }).strict(),
};

export class LeaderboardController {
  constructor(private readonly service: LeaderboardService) {}

  get = async (req: Request, res: Response): Promise<void> => {
    const { params, query } = validated(req, leaderboardSchema);
    setNoStore(res);
    sendSuccess(res, await this.service.get(params.id, query));
  };

  announce = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, announceSchema);
    const admin = currentAdmin(req);
    sendSuccess(
      res,
      await this.service.announceWinners(params.id, body.force, {
        kind: "admin",
        id: admin.id,
        label: admin.name,
      }),
    );
  };
}

/** Mounted at /v1/admin/campaigns (alongside the campaign CRUD router). */
export function createLeaderboardRouter(
  controller: LeaderboardController,
  auth: AdminAuthMiddleware,
): Router {
  const router = Router();
  router.get("/:id/leaderboard", validate(leaderboardSchema), controller.get);
  router.post(
    "/:id/announce-winners",
    auth.requireRole("admin"),
    validate(announceSchema),
    controller.announce,
  );
  return router;
}
