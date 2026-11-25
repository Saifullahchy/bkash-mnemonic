import { z } from "zod";

/** Bangladeshi mobile: 11 digits, 01 + operator digit 3-9 (e.g. 01712345678). */
export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/;

/** Accepts "+880 1712-345678", "8801712345678", "01712345678" → "01712345678". */
export function normalizeBdPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("880") ? digits.slice(2) : digits;
}

export const bdPhoneSchema = z
  .string()
  .trim()
  .min(1, "Mobile number is required")
  .max(20)
  .transform(normalizeBdPhone)
  .refine(
    (value) => BD_PHONE_REGEX.test(value),
    "Enter a valid 11-digit Bangladeshi mobile number",
  );
