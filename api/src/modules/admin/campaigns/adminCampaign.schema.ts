import { z } from "zod";
import { objectIdSchema } from "../../../core/http/schemas.js";
import { RANKING_BASIS, WINNER_SELECTION } from "../../campaign/campaign.model.js";

/*
 * No defaults here on purpose: the same field shapes serve create (Mongoose
 * fills defaults) and partial update (absent = unchanged).
 */
const text = (max: number) => z.string().trim().min(1).max(max);

const rewardFields = {
  title: text(80),
  winnerSelection: z.enum(WINNER_SELECTION),
  numberOfWinners: z.number().int().min(1).max(100),
  rankingBasis: z.enum(RANKING_BASIS),
};

const scheduleFields = {
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  validityLabel: z.string().trim().max(40),
};

const antiAbuseFields = {
  maxLinksPerDevice: z.number().int().min(1).max(100),
  maxOpensPerSubnetPerHour: z.number().int().min(1).max(10_000),
  maxOpensPerLinkPer10Min: z.number().int().min(1).max(100_000),
};

const settingsFields = {
  requirePhone: z.boolean(),
  showOnHome: z.boolean(),
  countLinkOpens: z.boolean(),
};

const startBeforeEnd = (s: { startAt?: Date; endAt?: Date }) =>
  !s.startAt || !s.endAt || s.endAt > s.startAt;

export const createCampaignSchema = {
  body: z
    .object({
      name: text(80),
      merchantName: text(60),
      offerTitle: text(120),
      description: z.string().trim().max(600).optional(),
      reward: z.object(rewardFields).partial({
        winnerSelection: true,
        numberOfWinners: true,
        rankingBasis: true,
      }),
      schedule: z
        .object(scheduleFields)
        .partial({ validityLabel: true })
        .refine(startBeforeEnd, { message: "End date must be after start date", path: ["endAt"] }),
      settings: z
        .object({ ...settingsFields, antiAbuse: z.object(antiAbuseFields).partial().optional() })
        .partial()
        .optional(),
      sortOrder: z.number().int().min(0).max(10_000).optional(),
    })
    .strict(),
};

export const updateCampaignSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z
    .object({
      name: text(80),
      merchantName: text(60),
      offerTitle: text(120),
      description: z.string().trim().max(600),
      reward: z.object(rewardFields).partial().strict(),
      schedule: z
        .object(scheduleFields)
        .partial()
        .strict()
        .refine(startBeforeEnd, { message: "End date must be after start date", path: ["endAt"] }),
      settings: z
        .object({ ...settingsFields, antiAbuse: z.object(antiAbuseFields).partial().strict() })
        .partial()
        .strict(),
      sortOrder: z.number().int().min(0).max(10_000),
    })
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, "Nothing to update"),
};

export const campaignIdSchema = { params: z.object({ id: objectIdSchema }) };

export const setActiveSchema = {
  params: z.object({ id: objectIdSchema }),
  body: z.object({ isActive: z.boolean() }).strict(),
};

export const MEDIA_KINDS = ["banner", "logo", "reward-banner", "prize-tile"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const uploadMediaSchema = {
  params: z.object({ id: objectIdSchema, kind: z.enum(MEDIA_KINDS) }),
};

export const CAMPAIGN_FILTERS = ["all", "live", "scheduled", "draft", "ended"] as const;
export type CampaignFilter = (typeof CAMPAIGN_FILTERS)[number];

export const listCampaignsSchema = {
  query: z
    .object({
      status: z.enum(CAMPAIGN_FILTERS).default("all"),
      search: z.string().trim().max(80).optional(),
      active: z.enum(["true", "false"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
};

export type CreateCampaignInput = z.output<typeof createCampaignSchema.body>;
export type UpdateCampaignInput = z.output<typeof updateCampaignSchema.body>;
