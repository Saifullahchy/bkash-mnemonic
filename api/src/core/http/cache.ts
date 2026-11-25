import type { Response } from "express";

/**
 * Public, non-personalised GETs can be cached briefly by browsers and a CDN.
 * stale-while-revalidate keeps responses instant while refreshing in the background.
 */
export function setPublicCache(res: Response, maxAgeSeconds: number): void {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`,
  );
}

/** Personalised responses must never be stored by a shared cache or CDN. */
export function setNoStore(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
}
