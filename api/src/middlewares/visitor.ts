import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { readVisitorId, VISITOR_COOKIE, visitorCookieOptions } from "../core/http/cookies.js";
import type { Fingerprinter } from "../core/security/fingerprint.js";

export interface VisitorContext {
  /** First-party cookie id (created on first contact). */
  id: string;
  deviceHash: string;
  subnetHash: string;
}

declare module "express-serve-static-core" {
  interface Request {
    visitor?: VisitorContext;
  }
}

/**
 * Identifies the browser (ofv cookie, issued here if missing) and fingerprints
 * the request (salted device + subnet hashes). The API owns this cookie, so
 * the rules for unique opens live in one place.
 */
export function createVisitorContext(fingerprinter: Fingerprinter): RequestHandler {
  return (req, res, next) => {
    let id = readVisitorId(req);
    if (!id) {
      id = randomUUID();
      res.cookie(VISITOR_COOKIE, id, visitorCookieOptions());
    }
    const userAgent = req.get("user-agent") ?? "";
    const acceptLanguage = req.get("accept-language") ?? "";
    const fingerprint = fingerprinter.compute({ ip: req.ip ?? "", userAgent, acceptLanguage });
    req.visitor = { id, ...fingerprint };
    next();
  };
}

/** The visitor context inside a handler mounted after createVisitorContext. */
export function visitorOf(req: Parameters<RequestHandler>[0]): VisitorContext {
  if (!req.visitor) throw new Error("visitor middleware was not applied to this route");
  return req.visitor;
}
