import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { isApiErrorBody } from "./envelope";

const FRIENDLY_MESSAGES: Record<string, string> = {
  TOO_MANY_REQUESTS: "Too many attempts. Please wait a few minutes and try again.",
  CAMPAIGN_NOT_LIVE: "This offer is not running right now.",
  UNAUTHORIZED: "Your session has expired. Please log in again.",
};

/** Error code from an RTK Query error, if the API sent one. */
export function getApiErrorCode(error: FetchBaseQueryError | SerializedError | undefined) {
  if (error && "status" in error && isApiErrorBody(error.data)) return error.data.error.code;
  return undefined;
}

/** A message safe to show users for any RTK Query error. */
export function getApiErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;
  if ("status" in error) {
    if (error.status === "FETCH_ERROR" || error.status === "TIMEOUT_ERROR") {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (isApiErrorBody(error.data)) {
      return FRIENDLY_MESSAGES[error.data.error.code] ?? error.data.error.message;
    }
  }
  return fallback;
}
