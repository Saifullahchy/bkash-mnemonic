import type { CampaignLifecycle } from "./campaign.domain.js";
import type { CampaignRecord } from "./campaign.model.js";

/**
 * Public shape of a campaign for the offer site. Deliberately excludes admin
 * fields (anti-abuse settings, createdBy, publish status, sort order…).
 */
export interface PublicOfferDto {
  id: string;
  slug: string;
  merchantName: string;
  /** Card heading, e.g. "Foodi Food Fair" (campaign name). */
  title: string;
  /** Card sub-line, e.g. "Tk 200 discount on food orders" (offer title). */
  subtitle: string;
  description: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  validityLabel: string;
  startAt: string;
  endAt: string;
  status: Extract<CampaignLifecycle, "live" | "ended">;
  reward: {
    title: string;
    rank: number;
    imageUrl: string | null;
    tileImageUrl: string | null;
  };
  /** Unique link opens across all participants (social proof). */
  totalOpens: number;
}

export function toPublicOfferDto(
  campaign: CampaignRecord,
  status: PublicOfferDto["status"],
): PublicOfferDto {
  return {
    id: campaign._id.toString(),
    slug: campaign.slug,
    merchantName: campaign.merchantName,
    title: campaign.name,
    subtitle: campaign.offerTitle,
    description: campaign.description,
    bannerUrl: campaign.media.bannerUrl ?? null,
    logoUrl: campaign.media.logoUrl ?? null,
    validityLabel: campaign.schedule.validityLabel,
    startAt: campaign.schedule.startAt.toISOString(),
    endAt: campaign.schedule.endAt.toISOString(),
    status,
    reward: {
      title: campaign.reward.title,
      rank: 1,
      imageUrl: campaign.reward.imageUrl ?? null,
      // Campaigns without their own tile picture reuse the reward banner's.
      tileImageUrl: campaign.reward.tileImageUrl ?? campaign.reward.imageUrl ?? null,
    },
    totalOpens: campaign.stats.opens,
  };
}
