import "server-only";
import { API_URL, proxyHeaders } from "./config";
import { isApiErrorBody, isApiSuccess } from "./envelope";

/**
 * Server-side API client for Server Components (public, non-personalised data).
 * Identifies itself with PROXY_SECRET, so page renders (which all come from this
 * server's address) don't share one visitor's rate limit.
 */
const TIMEOUT_MS = 8000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/json", ...proxyHeaders() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body: unknown = await res.json().catch(() => null);

  if (res.ok && isApiSuccess<T>(body)) return body.data;
  if (isApiErrorBody(body))
    throw new ApiRequestError(body.error.message, res.status, body.error.code);
  throw new ApiRequestError(`API request failed: ${res.status} ${path}`, res.status);
}

/** Like apiGet, but resolves to null on 404 (optional content). */
export async function apiGetOptional<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}
