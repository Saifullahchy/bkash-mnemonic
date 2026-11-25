import { z } from "zod";
import {
  endInputToIso,
  inputToDayMonth,
  isoToEndInput,
  isoToStartInput,
  startInputToIso,
  todayInput,
} from "@/lib/dates";
import type { AdminCampaign, CampaignInput } from "../types";

const required = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);
const cap = (label: string, max: number) =>
  z
    .number({ error: `${label} must be a number` })
    .int()
    .min(1, `${label} must be at least 1`)
    .max(max);

export const campaignFormSchema = z
  .object({
    name: required("Campaign name", 80),
    merchantName: required("Merchant name", 60),
    offerTitle: required("Offer title", 120),
    description: z.string().trim().max(600, "Description must be at most 600 characters"),
    rewardTitle: required("Reward title", 80),
    numberOfWinners: cap("Number of winners", 100),
    rankingBasis: z.enum(["opens", "shares"]),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    validityLabel: z.string().trim().max(40, "Keep the label under 40 characters"),
    requirePhone: z.boolean(),
    showOnHome: z.boolean(),
    countLinkOpens: z.boolean(),
    maxLinksPerDevice: cap("Links per device", 100),
    maxOpensPerSubnetPerHour: cap("Opens per network", 10_000),
    maxOpensPerLinkPer10Min: cap("Opens per 10 minutes", 100_000),
  })
  // Dates are inclusive whole days, so a one-day campaign (start = end) is valid.
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date can't be before the start date",
    path: ["endDate"],
  });

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const emptyCampaignForm = (): CampaignFormValues => ({
  name: "",
  merchantName: "",
  offerTitle: "",
  description: "",
  rewardTitle: "",
  numberOfWinners: 1,
  rankingBasis: "opens",
  startDate: todayInput(),
  endDate: todayInput(30),
  validityLabel: "",
  requirePhone: true,
  showOnHome: true,
  countLinkOpens: true,
  maxLinksPerDevice: 3,
  maxOpensPerSubnetPerHour: 5,
  maxOpensPerLinkPer10Min: 50,
});

export function campaignToForm(c: AdminCampaign): CampaignFormValues {
  const endDate = isoToEndInput(c.schedule.endAt);
  return {
    name: c.name,
    merchantName: c.merchantName,
    offerTitle: c.offerTitle,
    description: c.description,
    rewardTitle: c.reward.title,
    numberOfWinners: c.reward.numberOfWinners,
    rankingBasis: c.reward.rankingBasis,
    startDate: isoToStartInput(c.schedule.startAt),
    endDate,
    // An auto-generated label is shown as empty so it keeps following the end date.
    validityLabel:
      c.schedule.validityLabel === autoValidityLabel(endDate) ? "" : c.schedule.validityLabel,
    requirePhone: c.settings.requirePhone,
    showOnHome: c.settings.showOnHome,
    countLinkOpens: c.settings.countLinkOpens,
    ...c.settings.antiAbuse,
  };
}

export function autoValidityLabel(endDate: string): string {
  return endDate ? `Valid until ${inputToDayMonth(endDate)}` : "";
}

export function formToInput(v: CampaignFormValues): CampaignInput {
  return {
    name: v.name,
    merchantName: v.merchantName,
    offerTitle: v.offerTitle,
    description: v.description,
    reward: {
      title: v.rewardTitle,
      numberOfWinners: v.numberOfWinners,
      rankingBasis: v.rankingBasis,
    },
    schedule: {
      startAt: startInputToIso(v.startDate),
      endAt: endInputToIso(v.endDate),
      validityLabel: v.validityLabel || autoValidityLabel(v.endDate),
    },
    settings: {
      requirePhone: v.requirePhone,
      showOnHome: v.showOnHome,
      countLinkOpens: v.countLinkOpens,
      antiAbuse: {
        maxLinksPerDevice: v.maxLinksPerDevice,
        maxOpensPerSubnetPerHour: v.maxOpensPerSubnetPerHour,
        maxOpensPerLinkPer10Min: v.maxOpensPerLinkPer10Min,
      },
    },
  };
}

/** Live "Publishing" checklist (mirrors the API's publish readiness rules). */
export function readinessOf(
  v: Partial<CampaignFormValues>,
  media: { banner: boolean; rewardImage: boolean; prizeTile: boolean },
) {
  return {
    basicInfo: Boolean(v.name?.trim() && v.merchantName?.trim() && v.offerTitle?.trim()),
    reward: Boolean(v.rewardTitle?.trim()),
    schedule: Boolean(
      v.startDate && v.endDate && v.endDate >= v.startDate && v.endDate >= todayInput(),
    ),
    ...media,
  };
}
