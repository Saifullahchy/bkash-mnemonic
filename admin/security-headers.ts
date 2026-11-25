/**
 * Browser security headers for every route (see next.config.ts).
 *
 * The CSP limits where scripts, data and images can come from: this site
 * (API calls are same-origin; uploads may be served by the API). Next.js injects small inline bootstrap scripts, so script-src keeps
 * 'unsafe-inline' (a nonce would force every page to render dynamically and
 * lose static/partial prerendering); external scripts are still blocked, and
 * connect-src stops injected code from sending data to other sites.
 */
export function securityHeaders(options: {
  apiOrigin: string;
  imageOrigins?: string[];
  isDev: boolean;
}) {
  const { apiOrigin, imageOrigins = [], isDev } = options;
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${[apiOrigin, ...imageOrigins].join(" ")}`,
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(apiOrigin.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Only over HTTPS in production; never pin localhost to HTTPS.
    ...(isDev
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]),
  ];
}
