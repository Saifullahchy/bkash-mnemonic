import type { Campaign } from "./campaign.model.js";

export type CampaignLifecycle = "draft" | "scheduled" | "live" | "ended";

type LifecycleInput = Pick<Campaign, "status"> & {
  schedule: Pick<Campaign["schedule"], "startAt" | "endAt">;
};

/**
 * Single source of truth for a campaign's lifecycle, derived from its publish
 * status and dates (end is exclusive). Pure, so it is trivially unit-testable.
 */
export function getCampaignLifecycle(campaign: LifecycleInput, now: Date): CampaignLifecycle {
  if (campaign.status === "draft") return "draft";
  if (now < campaign.schedule.startAt) return "scheduled";
  if (now >= campaign.schedule.endAt) return "ended";
  return "live";
}
