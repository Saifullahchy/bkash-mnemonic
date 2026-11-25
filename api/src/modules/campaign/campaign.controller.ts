import type { Request, Response } from "express";
import { setPublicCache } from "../../core/http/cache.js";
import { sendSuccess } from "../../core/http/apiResponse.js";
import { validated } from "../../middlewares/validate.js";
import { getCampaignSchema } from "./campaign.schema.js";
import type { CampaignService } from "./campaign.service.js";

/** HTTP adapter only: read validated input, call the service, send the envelope. */
export class CampaignController {
  constructor(private readonly service: CampaignService) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const offers = await this.service.listLiveOffers();
    setPublicCache(res, 30);
    sendSuccess(res, offers, { meta: { count: offers.length } });
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, getCampaignSchema);
    const offer = await this.service.getOffer(params.id);
    setPublicCache(res, 30);
    sendSuccess(res, offer);
  };
}
