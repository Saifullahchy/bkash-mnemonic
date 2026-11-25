import type { CookieOptions, Request } from "express";
import { cookieSecure, env } from "../../config/env.js";

/** Participant session JWT (httpOnly; never readable by page scripts). */
export const SESSION_COOKIE = "of_session";
/** Admin panel session JWT (httpOnly, SameSite=Strict). */
export const ADMIN_SESSION_COOKIE = "of_admin";
/** First-party visitor id (issued by the API on first contact; used for unique opens). */
export const VISITOR_COOKIE = "ofv";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Attributes must match on set and clear, or the browser keeps the cookie. */
export function clearSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure,
    // Lax: sent on top-level navigation and same-site fetches (offer-finder.com ->
    // api.offer-finder.com are same-site), never on cross-site POSTs (CSRF).
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeMs,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Long-lived first-party visitor id (identifies a browser, not a person). */
export function visitorCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_MS,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/** A cookie value as a string, or undefined (cookie-parser types the jar as any). */
export function readCookie(req: Request, name: string): string | undefined {
  const jar = req.cookies as Record<string, unknown> | undefined;
  const value = jar?.[name];
  return typeof value === "string" ? value : undefined;
}

/** The visitor cookie value, only if it is a well-formed UUID. */
export function readVisitorId(req: Request): string | undefined {
  const value = readCookie(req, VISITOR_COOKIE);
  return typeof value === "string" && UUID_REGEX.test(value) ? value.toLowerCase() : undefined;
}

/**
 * Admin cookie: Strict (admin.offer-finder.com → api.offer-finder.com is
 * same-site, so it is still sent). Without "keep me signed in" it is a
 * browser-session cookie; the JWT inside expires after ADMIN_SESSION_TTL_HOURS.
 */
export function adminCookieOptions(maxAgeMs?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "strict",
    path: "/",
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}
