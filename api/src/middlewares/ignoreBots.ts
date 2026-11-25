import type { RequestHandler } from "express";
import { sendSuccess } from "../core/http/apiResponse.js";
import { isBotUserAgent } from "../core/security/botDetector.js";

/**
 * Crawlers, link-preview fetchers and scripted clients are never counted.
 * They get the same quiet `202 { counted: false }` as any other rejected open
 * (no error, no signal to tune against) and nothing is written to the database.
 * The landing page itself still opens for everyone; only counting is affected.
 */
export const ignoreBots: RequestHandler = (req, res, next) => {
  if (isBotUserAgent(req.get("user-agent"))) {
    req.log.info({ reason: "bot", userAgent: req.get("user-agent") }, "link open ignored");
    sendSuccess(res, { counted: false }, { status: 202 });
    return;
  }
  next();
};
