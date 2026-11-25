import { z } from "zod";

export const shareCodeSchema = z.string().regex(/^[0-9A-Za-z]{8}$/, "Invalid share code");

export const getLandingSchema = {
  params: z.object({ code: shareCodeSchema }),
};

export const recordOpenSchema = {
  body: z
    .object({
      code: shareCodeSchema,
      token: z.string().min(1).max(512),
      /** Honeypot: real pages always send an empty string. */
      hp: z.string().max(200).optional(),
    })
    .strict(),
};
