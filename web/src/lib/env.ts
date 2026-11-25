import { z } from "zod";

/**
 * Public runtime configuration, validated once at import time so a
 * misconfigured deploy fails fast instead of producing broken links.
 * NEXT_PUBLIC_* values must be referenced literally to be inlined by Next.js.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

/** Browser-facing API base: same origin, forwarded to the API (app/api/v1/[...path]). */
export const API_BASE = "/api/v1";
