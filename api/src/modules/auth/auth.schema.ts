import { z } from "zod";
import { bdPhoneSchema } from "../../core/utils/phone.js";

export const phoneLoginSchema = {
  body: z.object({ phone: bdPhoneSchema }).strict(),
};
