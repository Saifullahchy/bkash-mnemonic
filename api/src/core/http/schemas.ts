import { z } from "zod";

/** 24-char hex MongoDB ObjectId in a URL param or body field. */
export const objectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");
