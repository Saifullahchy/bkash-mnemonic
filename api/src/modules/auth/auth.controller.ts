import type { Request, Response } from "express";
import { sendSuccess } from "../../core/http/apiResponse.js";
import { setNoStore } from "../../core/http/cache.js";
import {
  clearSessionCookieOptions,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../../core/http/cookies.js";
import type { SessionTokens } from "../../core/security/sessionTokens.js";
import { validated } from "../../middlewares/validate.js";
import { visitorOf } from "../../middlewares/visitor.js";
import { phoneLoginSchema } from "./auth.schema.js";
import type { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(
    private readonly service: AuthService,
    private readonly tokens: SessionTokens,
  ) {}

  loginWithPhone = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, phoneLoginSchema);
    const visitor = visitorOf(req);
    const { participant, sessionToken } = await this.service.loginWithPhone(body.phone, {
      visitorId: visitor.id,
      deviceHash: visitor.deviceHash,
    });
    res.cookie(SESSION_COOKIE, sessionToken, sessionCookieOptions(this.tokens.maxAgeMs));
    setNoStore(res);
    sendSuccess(res, { participant });
  };

  logout = (_req: Request, res: Response): void => {
    res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions());
    setNoStore(res);
    sendSuccess(res, { participant: null });
  };

  /** Who is logged in? Guests get `participant: null` (200, not 401) to keep consoles clean. */
  session = async (req: Request, res: Response): Promise<void> => {
    setNoStore(res);
    if (!req.participant) {
      sendSuccess(res, { participant: null });
      return;
    }
    const participant = await this.service.getSessionParticipant(req.participant.participantId);
    if (!participant) this.logout(req, res);
    else sendSuccess(res, { participant });
  };
}
