import type { Request, RequestHandler } from "express";
import type { z } from "zod";

/** Zod schemas for the parts of a request a route wants validated. */
export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type Infer<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface Validated<S extends RequestSchemas> {
  params: Infer<S["params"]>;
  query: Infer<S["query"]>;
  body: Infer<S["body"]>;
}

declare module "express-serve-static-core" {
  interface Request {
    /** Parsed + coerced request parts, set by the `validate` middleware. */
    validated?: { params?: unknown; query?: unknown; body?: unknown };
  }
}

/**
 * Validates and coerces params/query/body before the controller runs.
 * Results live on `req.validated` (Express 5's req.query is read-only).
 * A ZodError is converted to a 400 VALIDATION_ERROR by the error handler.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    req.validated = {
      params: schemas.params?.parse(req.params),
      query: schemas.query?.parse(req.query),
      body: schemas.body?.parse(req.body),
    };
    next();
  };
}

/** Typed access to what `validate(schemas)` produced, inside a controller. */
export function validated<S extends RequestSchemas>(req: Request, _schemas: S): Validated<S> {
  if (!req.validated) throw new Error("validate() middleware was not applied to this route");
  return req.validated as Validated<S>;
}
