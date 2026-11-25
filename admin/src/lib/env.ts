import { z } from "zod";

/** Validated public configuration (NEXT_PUBLIC_* must be referenced literally). */
export const env = z
  .object({
    /** Offer site, used to show share-link format and "view on site" links. */
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  })
  .parse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

/** Browser-facing API base: same origin, forwarded to the API (app/api/v1/[...path]). */
export const API_BASE = "/api/v1";
