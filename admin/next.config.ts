import type { NextConfig } from "next";
import { securityHeaders } from "./security-headers";

const apiOrigin = new URL(process.env.API_URL ?? "http://localhost:4000/v1").origin;
// Extra image hosts (ImageKit/CDN), same format as the offer site: comma-separated URL patterns.
const imageOrigins = (process.env.IMAGE_REMOTE_PATTERNS ?? "")
  .split(",")
  .map((pattern) => pattern.trim())
  .filter(Boolean)
  .map((pattern) => new URL(pattern).origin);
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders({ apiOrigin, imageOrigins, isDev }) },
      // The admin panel must never be indexed by search engines.
      { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
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
