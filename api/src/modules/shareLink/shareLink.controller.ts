import type { Request, Response } from "express";
import { sendSuccess } from "../../core/http/apiResponse.js";
import { setNoStore } from "../../core/http/cache.js";
import { participantId } from "../../middlewares/auth.js";
import { validated } from "../../middlewares/validate.js";
import { getOrCreateLinkSchema, recordShareSchema } from "./shareLink.schema.js";
import type { ShareLinkService } from "./shareLink.service.js";

export class ShareLinkController {
  constructor(private readonly service: ShareLinkService) {}

  /** PUT /campaigns/:id/link — idempotent get-or-create (201 when newly created). */
  getOrCreate = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, getOrCreateLinkSchema);
    const { link, created } = await this.service.getOrCreate(participantId(req), params.id);
    setNoStore(res);
    sendSuccess(res, link, { status: created ? 201 : 200 });
  };

  /** POST /track/share */
  recordShare = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, recordShareSchema);
    const result = await this.service.recordShare(participantId(req), body.campaignId);
    setNoStore(res);
    sendSuccess(res, result, { status: 202 });
  };

  /** GET /me/activity */
  activity = async (req: Request, res: Response): Promise<void> => {
    const items = await this.service.getActivity(participantId(req));
    setNoStore(res);
    sendSuccess(res, items);
  };
}
