import type { Request, RequestHandler } from "express";
import { UnauthorizedError } from "../core/errors/AppError.js";
import { readCookie, SESSION_COOKIE } from "../core/http/cookies.js";
import type { ParticipantSession, SessionTokens } from "../core/security/sessionTokens.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Set when a valid participant session cookie is present. */
    participant?: ParticipantSession;
  }
}

export interface AuthMiddleware {
  /** Attaches `req.participant` if the session is valid; never rejects. */
  optionalParticipant: RequestHandler;
  /** Rejects with 401 unless a valid participant session is present. */
  requireParticipant: RequestHandler;
}

export function createAuthMiddleware(tokens: SessionTokens): AuthMiddleware {
  const attach = async (req: Request) => {
    const session = await tokens.verify(readCookie(req, SESSION_COOKIE));
    if (session) req.participant = session;
  };

  return {
    optionalParticipant: async (req, _res, next) => {
      await attach(req);
      next();
    },
    requireParticipant: async (req, _res, next) => {
      await attach(req);
      if (!req.participant) throw new UnauthorizedError("Please log in with your mobile number");
      next();
    },
  };
}

/** The authenticated participant id inside a handler behind requireParticipant. */
export function participantId(req: Request): string {
  if (!req.participant) throw new UnauthorizedError();
  return req.participant.participantId;
}
