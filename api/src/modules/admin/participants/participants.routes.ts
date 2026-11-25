import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../../core/http/apiResponse.js";
import { setNoStore } from "../../../core/http/cache.js";
import { objectIdSchema } from "../../../core/http/schemas.js";
import { currentAdmin, type AdminAuthMiddleware } from "../../../middlewares/adminAuth.js";
import { validate, validated } from "../../../middlewares/validate.js";
import type { ModerationService } from "../moderation/moderation.service.js";
import type { ParticipantsService } from "./participants.service.js";

export const listParticipantsSchema = {
  query: z
    .object({
      search: z.string().trim().max(20).optional(),
      campaignId: objectIdSchema.optional(),
      activeWithin: z.enum(["7d", "30d", "all"]).default("all"),
      status: z.enum(["all", "active", "idle", "disqualified"]).default("all"),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
};
const idParam = { params: z.object({ id: objectIdSchema }) };
const disqualifySchema = {
  ...idParam,
  body: z.object({ reason: z.string().trim().min(3).max(200) }).strict(),
};

const actorOf = (req: Request) => {
  const admin = currentAdmin(req);
  return { kind: "admin" as const, id: admin.id, label: admin.name };
};

export class ParticipantsController {
  constructor(
    private readonly participants: ParticipantsService,
    private readonly moderation: ModerationService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, listParticipantsSchema);
    const { items, ...meta } = await this.participants.list(query);
    setNoStore(res);
    sendSuccess(res, items, { meta });
  };

  detail = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, idParam);
    setNoStore(res);
    sendSuccess(res, await this.participants.detail(params.id));
  };

  disqualify = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, disqualifySchema);
    sendSuccess(res, await this.participants.disqualify(params.id, body.reason, actorOf(req)));
  };

  reinstate = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, idParam);
    sendSuccess(res, await this.participants.reinstate(params.id, actorOf(req)));
  };

  voidOpens = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, idParam);
    sendSuccess(res, await this.moderation.voidOpens(params.id, actorOf(req)));
  };

  clearFlag = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, idParam);
    await this.moderation.clearFlag(params.id);
    res.status(204).end();
  };

  scan = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, { flagged: await this.moderation.scan() });
  };
}

/** Participants + moderation, mounted at /v1/admin. Changes need the "admin" role. */
export function createParticipantsRouter(
  controller: ParticipantsController,
  auth: AdminAuthMiddleware,
): Router {
  const router = Router();
  const canModerate = auth.requireRole("admin");
  router.get("/participants", validate(listParticipantsSchema), controller.list);
  router.get("/participants/:id", validate(idParam), controller.detail);
  router.post(
    "/participants/:id/disqualify",
    canModerate,
    validate(disqualifySchema),
    controller.disqualify,
  );
  router.post("/participants/:id/reinstate", canModerate, validate(idParam), controller.reinstate);
  router.post("/share-links/:id/void-opens", canModerate, validate(idParam), controller.voidOpens);
  router.post("/share-links/:id/clear-flag", canModerate, validate(idParam), controller.clearFlag);
  router.post("/moderation/scan", canModerate, controller.scan);
  return router;
}
