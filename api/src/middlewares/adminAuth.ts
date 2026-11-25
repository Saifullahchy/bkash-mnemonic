import type { Request, RequestHandler } from "express";
import { ForbiddenError, UnauthorizedError } from "../core/errors/AppError.js";
import { ADMIN_SESSION_COOKIE, readCookie } from "../core/http/cookies.js";
import type { SessionTokens } from "../core/security/sessionTokens.js";
import type { AdminRole } from "../modules/admin/admin.model.js";
import {
  toAdminDto,
  type AdminAuthService,
  type AdminDto,
} from "../modules/admin/auth/adminAuth.service.js";

declare module "express-serve-static-core" {
  interface Request {
    /** Set by requireAdmin for authenticated, active admins. */
    admin?: AdminDto;
  }
}

export interface AdminAuthMiddleware {
  requireAdmin: RequestHandler;
  requireRole: (...roles: AdminRole[]) => RequestHandler;
}

/**
 * Admin routes: a valid admin JWT (separate secret + audience from participants)
 * AND an account that still exists and is active — checked against the DB on
 * every request so deactivating an admin takes effect immediately.
 */
export function createAdminAuthMiddleware(
  tokens: SessionTokens,
  service: AdminAuthService,
): AdminAuthMiddleware {
  return {
    requireAdmin: async (req, _res, next) => {
      const claims = await tokens.verifySubject(readCookie(req, ADMIN_SESSION_COOKIE));
      const admin = claims ? await service.getActiveAdmin(claims.subjectId) : null;
      if (!admin) throw new UnauthorizedError("Please sign in to the admin panel");
      req.admin = toAdminDto(admin);
      next();
    },
    requireRole:
      (...roles) =>
      (req, _res, next) => {
        if (!req.admin || !roles.includes(req.admin.role)) {
          throw new ForbiddenError("Your role does not allow this action");
        }
        next();
      },
  };
}

export function currentAdmin(req: Request): AdminDto {
  if (!req.admin) throw new UnauthorizedError();
  return req.admin;
}
