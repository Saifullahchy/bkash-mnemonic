import type { Request, Response } from "express";
import { setPublicCache } from "../../core/http/cache.js";
import { sendSuccess } from "../../core/http/apiResponse.js";
import type { StatsService } from "./stats.service.js";

export class StatsController {
  constructor(private readonly service: StatsService) {}

  getPublic = async (_req: Request, res: Response): Promise<void> => {
    const stats = await this.service.getPublicStats();
    setPublicCache(res, 60);
    sendSuccess(res, stats);
  };
}
