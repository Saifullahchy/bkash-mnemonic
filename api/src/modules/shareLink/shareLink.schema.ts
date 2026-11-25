import { z } from "zod";
import { objectIdSchema } from "../../core/http/schemas.js";

export const getOrCreateLinkSchema = {
  params: z.object({ id: objectIdSchema }),
};

export const recordShareSchema = {
  body: z.object({ campaignId: objectIdSchema }).strict(),
};
