import { z } from "zod";

/** Bangladeshi mobile: 11 digits, 01 + operator digit 3-9 (e.g. 01712345678). */
export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

/** Strips spaces/dashes and a leading +88 / 88 so users can paste any format. */
export function normalizeBdPhone(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  return digits.startsWith("880") ? digits.slice(2) : digits;
}

export const phoneLoginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Enter your mobile number")
    .transform(normalizeBdPhone)
    .refine((value) => BD_PHONE_REGEX.test(value), "Enter a valid 11-digit mobile number"),
  acceptedTerms: z.boolean().refine(Boolean, "Please accept the Terms & Conditions"),
});

export type PhoneLoginInput = z.input<typeof phoneLoginSchema>;
export type PhoneLoginValues = z.output<typeof phoneLoginSchema>;
