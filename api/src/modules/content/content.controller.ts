import type { Request, Response } from "express";
import { setPublicCache } from "../../core/http/cache.js";
import { sendSuccess } from "../../core/http/apiResponse.js";
import type { ContentService } from "./content.service.js";

export class ContentController {
  constructor(private readonly service: ContentService) {}

  getTerms = async (_req: Request, res: Response): Promise<void> => {
    const terms = await this.service.getTerms();
    setPublicCache(res, 300);
    sendSuccess(res, terms);
  };
}
