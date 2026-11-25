import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { isProduction } from "../config/env.js";
import { AppError, NotFoundError } from "../core/errors/AppError.js";
import { sendError } from "../core/http/apiResponse.js";

/** Unmatched routes become a 404 in the standard envelope. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};

function isDuplicateKeyError(error: unknown): error is { code: 11000; keyValue?: unknown } {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function isBodyParseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}

function isClientHttpError(error: unknown): error is { status: number; message: string } {
  if (typeof error !== "object" || error === null || !("status" in error)) return false;
  const { status } = error;
  return typeof status === "number" && status >= 400 && status < 500 && "expose" in error;
}

/** Converts known error types into AppErrors; returns null for unexpected ones. */
function toAppError(error: unknown): AppError | null {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    return new AppError(
      "Request validation failed",
      400,
      "VALIDATION_ERROR",
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  if (error instanceof mongoose.Error.CastError) {
    return new AppError(`Invalid value for ${error.path}`, 400, "BAD_REQUEST");
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return new AppError(
      "Validation failed",
      400,
      "VALIDATION_ERROR",
      Object.values(error.errors).map((e) => ({
        path: e.path,
        message: e.message,
      })),
    );
  }
  if (isDuplicateKeyError(error)) {
    return new AppError("Resource already exists", 409, "CONFLICT");
  }
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE")
      return new AppError("File is too large", 413, "FILE_TOO_LARGE");
    return new AppError(`Upload rejected: ${error.message}`, 400, "BAD_REQUEST");
  }
  if (isClientHttpError(error)) {
    // Standard http-errors (e.g. express.static's 404 for a missing upload).
    return error.status === 404
      ? new NotFoundError("File")
      : new AppError(error.message, error.status, "BAD_REQUEST");
  }
  if (isBodyParseError(error)) {
    return new AppError("Malformed JSON body", 400, "BAD_REQUEST");
  }
  return null;
}

/**
 * Last middleware in the chain. Expected errors are returned as-is; anything
 * else is logged with its stack and hidden behind a generic 500 message.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const requestId = typeof req.id === "string" ? req.id : undefined;
  const appError = toAppError(error);

  if (appError) {
    if (appError.statusCode >= 500) req.log.error({ err: error }, appError.message);
    sendError(res, appError.statusCode, {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details }),
      ...(requestId ? { requestId } : {}),
    });
    return;
  }

  req.log.error({ err: error }, "Unhandled error");
  sendError(res, 500, {
    code: "INTERNAL_ERROR",
    message: isProduction
      ? "Something went wrong"
      : error instanceof Error
        ? error.message
        : "Unknown error",
    ...(requestId ? { requestId } : {}),
  });
};
