import "server-only";

/** The API as seen from this server, e.g. https://api.example.com/v1 (read at runtime). */
export const API_URL = (process.env.API_URL ?? "http://localhost:4000/v1").replace(/\/+$/, "");

/**
 * Proves to the API that a request comes from our own server (same PROXY_SECRET on both), so it
 * can trust the visitor IP passed along. Sent server-to-server only.
 */
export function proxyHeaders(clientIp?: string): Record<string, string> {
  const secret = process.env.PROXY_SECRET;
  if (!secret) return {};
  return { "X-Proxy-Secret": secret, ...(clientIp ? { "X-Client-IP": clientIp } : {}) };
}
