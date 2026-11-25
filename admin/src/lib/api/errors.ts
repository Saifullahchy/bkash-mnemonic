import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { isApiErrorBody } from "./envelope";

type ApiError = FetchBaseQueryError | SerializedError | undefined;

export function getApiErrorCode(error: ApiError): string | undefined {
  if (error && "status" in error && isApiErrorBody(error.data)) return error.data.error.code;
  return undefined;
}

export function getApiErrorDetails(error: ApiError): unknown {
  if (error && "status" in error && isApiErrorBody(error.data)) return error.data.error.details;
  return undefined;
}

/** A message safe to show admins for any RTK Query error. */
export function getApiErrorMessage(
  error: ApiError,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;
  if ("status" in error) {
    if (error.status === "FETCH_ERROR" || error.status === "TIMEOUT_ERROR") {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (isApiErrorBody(error.data)) {
      const { code, message, details } = error.data.error;
      if (
        code === "CAMPAIGN_INCOMPLETE" &&
        details &&
        typeof details === "object" &&
        "missing" in details
      ) {
        return `Add before publishing: ${(details as { missing: string[] }).missing.join(", ")}`;
      }
      if (code === "VALIDATION_ERROR" && Array.isArray(details) && details.length > 0) {
        const first = details[0] as { message?: string };
        return first.message ?? message;
      }
      return message;
    }
  }
  return fallback;
}
