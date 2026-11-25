import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

/**
 * Hosts allowed for optimised <Image>:
 *  - the API's /uploads (banners/logos uploaded in the admin panel), derived
 *    from API_URL so it always works without extra config;
 *  - this site's /mock artwork (seeded demo banners and prizes);
 *  - extra patterns (e.g. a CDN) from IMAGE_REMOTE_PATTERNS, comma-separated:
 *      IMAGE_REMOTE_PATTERNS=https://cdn.offer-finder.com/**
 */
const apiOrigin = new URL(process.env.API_URL ?? "http://localhost:4000/v1").origin;
const siteOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").origin;
const remotePatterns = [
  new URL(`${apiOrigin}/uploads/**`),
  // Seeded demo campaigns point at this site's own /mock artwork by absolute URL.
  new URL(`${siteOrigin}/mock/**`),
  ...(process.env.IMAGE_REMOTE_PATTERNS ?? "")
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean)
    .map((pattern) => new URL(pattern)),
];

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const imageOrigins = remotePatterns.map((p) => p.origin).filter((o) => o !== apiOrigin);
    return [{ source: "/:path*", headers: securityHeaders({ apiOrigin, imageOrigins, isDev }) }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns,
    // The local API runs on localhost in development; never allow private IPs in production (SSRF risk).
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
