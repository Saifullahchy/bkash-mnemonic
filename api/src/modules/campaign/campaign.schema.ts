import { z } from "zod";
import { objectIdSchema } from "../../core/http/schemas.js";

export const getCampaignSchema = {
  params: z.object({ id: objectIdSchema }),
};
