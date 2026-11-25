import type { Response } from "express";

/**
 * Every endpoint responds with the same envelope so clients (RTK Query on the
 * web and admin apps) can handle success and errors uniformly.
 *
 *   { success: true,  data, meta? }
 *   { success: false, error: { code, message, details?, requestId } }
 */
export interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: Record<string, unknown> } = {},
): void {
  const body: SuccessBody<T> = { success: true, data };
  if (options.meta) body.meta = options.meta;
  res.status(options.status ?? 200).json(body);
}

export function sendError(res: Response, status: number, error: ErrorBody["error"]): void {
  const body: ErrorBody = { success: false, error };
  res.status(status).json(body);
}
