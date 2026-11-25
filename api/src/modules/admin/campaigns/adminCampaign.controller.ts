import type { Request, Response } from "express";
import { sendSuccess } from "../../../core/http/apiResponse.js";
import { setNoStore } from "../../../core/http/cache.js";
import { currentAdmin } from "../../../middlewares/adminAuth.js";
import { validated } from "../../../middlewares/validate.js";
import {
  campaignIdSchema,
  createCampaignSchema,
  listCampaignsSchema,
  setActiveSchema,
  updateCampaignSchema,
  uploadMediaSchema,
} from "./adminCampaign.schema.js";
import type { AdminCampaignService } from "./adminCampaign.service.js";

const actorOf = (req: Request) => {
  const admin = currentAdmin(req);
  return { kind: "admin" as const, id: admin.id, label: admin.name };
};

export class AdminCampaignController {
  constructor(private readonly service: AdminCampaignService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, listCampaignsSchema);
    const result = await this.service.list({
      filter: query.status,
      search: query.search,
      active: query.active === undefined ? undefined : query.active === "true",
      page: query.page,
      limit: query.limit,
    });
    setNoStore(res);
    sendSuccess(res, result.items, {
      meta: { total: result.total, page: result.page, limit: result.limit, counts: result.counts },
    });
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, campaignIdSchema);
    setNoStore(res);
    sendSuccess(res, await this.service.get(params.id));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, createCampaignSchema);
    sendSuccess(res, await this.service.create(body, actorOf(req)), { status: 201 });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, updateCampaignSchema);
    sendSuccess(res, await this.service.update(params.id, body));
  };

  publish = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, campaignIdSchema);
    sendSuccess(res, await this.service.publish(params.id, actorOf(req)));
  };

  unpublish = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, campaignIdSchema);
    sendSuccess(res, await this.service.unpublish(params.id, actorOf(req)));
  };

  setActive = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, setActiveSchema);
    sendSuccess(res, await this.service.setActive(params.id, body.isActive, actorOf(req)));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, campaignIdSchema);
    await this.service.delete(params.id, actorOf(req));
    res.status(204).end();
  };

  uploadMedia = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, uploadMediaSchema);
    sendSuccess(res, await this.service.uploadMedia(params.id, params.kind, req.file));
  };
}
