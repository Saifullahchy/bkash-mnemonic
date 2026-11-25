import cors from "cors";
import helmet from "helmet";
import type { RequestHandler } from "express";

/** Security headers suited to a JSON API (no HTML is served). */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: "same-site" },
});

/**
 * Only the offer site and admin panel may call the API from a browser.
 * `credentials: true` is required for the httpOnly session/visitor cookies.
 */
export function corsPolicy(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return cors({
    origin(origin, callback) {
      // Non-browser clients (curl, server-to-server) send no Origin header.
      callback(null, !origin || allowed.has(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "RateLimit", "RateLimit-Policy", "Retry-After"],
    maxAge: 600,
  });
}
