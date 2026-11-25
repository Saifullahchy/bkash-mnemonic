import "server-only";
import { API_URL, proxyHeaders } from "./config";

/** Request headers the API needs; everything else (Host, X-Forwarded-*…) stays here. */
const REQUEST_HEADERS = ["accept", "accept-language", "content-type", "cookie", "user-agent"];
const RESPONSE_HEADERS = [
  "cache-control",
  "content-disposition",
  "content-type",
  "ratelimit",
  "ratelimit-policy",
  "retry-after",
  "x-request-id",
];
const TIMEOUT_MS = 30_000;

const errorResponse = (status: number, code: string, message: string) =>
  Response.json({ success: false, error: { code, message } }, { status });

/**
 * The visitor's IP as reported by the hosting platform. CLIENT_IP_HEADER must name a header the
 * platform always overwrites (Render: cf-connecting-ip), or visitors could fake their address.
 * Without it, the last X-Forwarded-For entry (added by the nearest proxy) is used.
 */
function clientIp(headers: Headers): string | undefined {
  const trusted = process.env.CLIENT_IP_HEADER;
  const value = trusted ? headers.get(trusted) : headers.get("x-forwarded-for")?.split(",").at(-1);
  return value?.trim() || undefined;
}

export async function forwardToApi(request: Request, path: string[]): Promise<Response> {
  if (path.some((segment) => /^\.{0,2}$/.test(segment))) {
    return errorResponse(404, "NOT_FOUND", "Not found");
  }
  // The admin API is only reachable through the admin panel.
  if (path[0] === "admin") return errorResponse(404, "NOT_FOUND", "Not found");

  const readOnly = request.method === "GET" || request.method === "HEAD";
  if (!readOnly && request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse(403, "FORBIDDEN", "Cross-site requests are not allowed");
  }

  // Never vouch for a request whose visitor is unknown: the API would treat it as our own.
  const ip = clientIp(request.headers);
  const headers = new Headers(ip ? proxyHeaders(ip) : undefined);
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let upstream: Response;
  try {
    const target = `${API_URL}/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;
    upstream = await fetch(target, {
      method: request.method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Uploads are streamed through; Node's fetch needs `duplex` for that.
      ...(readOnly || !request.body ? {} : { body: request.body, duplex: "half" }),
    } as RequestInit);
  } catch (error) {
    console.error("API request failed", error);
    return errorResponse(502, "API_UNAVAILABLE", "The service is unavailable, please try again");
  }

  const responseHeaders = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
