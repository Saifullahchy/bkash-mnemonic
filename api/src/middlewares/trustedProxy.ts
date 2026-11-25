import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { RequestHandler } from "express";

declare module "express-serve-static-core" {
  interface Request {
    /** Made by our own web server for itself (page render), not on behalf of one visitor. */
    internal?: boolean;
  }
}

const digest = (value: string) => createHash("sha256").update(value).digest();

/**
 * Browsers reach the API through the web/admin servers, so the connection's IP is theirs. With
 * the shared secret those servers may state the visitor's real IP, which becomes `req.ip` for
 * rate limits and unique-open rules. Without it, the headers are ignored (anyone can send them).
 */
export function trustedProxy(secret: string | undefined): RequestHandler {
  const expected = secret ? digest(secret) : undefined;
  return (req, _res, next) => {
    const given = req.get("x-proxy-secret");
    if (expected && given && timingSafeEqual(digest(given), expected)) {
      const ip = req.get("x-client-ip");
      if (!ip) req.internal = true;
      else if (isIP(ip)) Object.defineProperty(req, "ip", { value: ip, configurable: true });
    }
    next();
  };
}
