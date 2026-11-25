import type { Request, Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../../core/http/apiResponse.js";
import { setNoStore } from "../../../core/http/cache.js";
import { ADMIN_SESSION_COOKIE, adminCookieOptions } from "../../../core/http/cookies.js";
import { currentAdmin } from "../../../middlewares/adminAuth.js";
import { validated } from "../../../middlewares/validate.js";
import type { AdminAuthService } from "./adminAuth.service.js";

export const adminLoginSchema = {
  body: z
    .object({
      email: z.email().max(120).trim().toLowerCase(),
      password: z.string().min(1).max(200),
      remember: z.boolean().default(false),
    })
    .strict(),
};

export class AdminAuthController {
  constructor(private readonly service: AdminAuthService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, adminLoginSchema);
    const result = await this.service.login(body.email, body.password, body.remember);
    res.cookie(ADMIN_SESSION_COOKIE, result.token, adminCookieOptions(result.cookieMaxAgeMs));
    setNoStore(res);
    sendSuccess(res, { admin: result.admin });
  };

  logout = (_req: Request, res: Response): void => {
    res.clearCookie(ADMIN_SESSION_COOKIE, adminCookieOptions());
    setNoStore(res);
    sendSuccess(res, { admin: null });
  };

  me = (req: Request, res: Response): void => {
    setNoStore(res);
    sendSuccess(res, { admin: currentAdmin(req) });
  };
}
