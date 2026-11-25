import type { Request, Response } from "express";
import { sendSuccess } from "../../core/http/apiResponse.js";
import { setNoStore } from "../../core/http/cache.js";
import { visitorOf } from "../../middlewares/visitor.js";
import { validated } from "../../middlewares/validate.js";
import { getLandingSchema, recordOpenSchema } from "./tracking.schema.js";
import type { TrackingService } from "./tracking.service.js";

export class TrackingController {
  constructor(private readonly service: TrackingService) {}

  /** GET /share/:code — offer shown on the landing page + a fresh open token. */
  landing = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, getLandingSchema);
    const landing = await this.service.getLanding(params.code);
    setNoStore(res); // each render needs its own single-use token
    sendSuccess(res, landing);
  };

  /**
   * POST /track/open — always 202 { counted } without the reason, so abusers
   * learn nothing about which rule stopped them. Reasons go to the logs/DB.
   */
  recordOpen = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, recordOpenSchema);
    const visitor = visitorOf(req);
    const result = await this.service.recordOpen({
      code: body.code,
      token: body.token,
      honeypot: body.hp,
      visitorId: visitor.id,
      deviceHash: visitor.deviceHash,
      subnetHash: visitor.subnetHash,
      sessionParticipantId: req.participant?.participantId,
    });
    req.log.info({ code: body.code, counted: result.counted, reason: result.reason }, "link open");
    setNoStore(res);
    sendSuccess(res, { counted: result.counted }, { status: 202 });
  };
}
