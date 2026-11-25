import { getCampaignLifecycle, type CampaignLifecycle } from "../../campaign/campaign.domain.js";
import type { Campaign, CampaignRecord } from "../../campaign/campaign.model.js";

/** "Publishing" checklist from the New Campaign design. */
export interface PublishReadiness {
  basicInfo: boolean;
  reward: boolean;
  schedule: boolean;
  banner: boolean;
  logo: boolean;
  rewardImage: boolean;
  prizeTile: boolean;
  /** Everything required to publish (logo and prize images are recommended, not required). */
  canPublish: boolean;
  missing: string[];
}

export function getPublishReadiness(c: Campaign, now: Date): PublishReadiness {
  const basicInfo = Boolean(c.name && c.merchantName && c.offerTitle);
  const reward = Boolean(c.reward.title);
  const schedule = c.schedule.endAt > c.schedule.startAt && c.schedule.endAt > now;
  const banner = Boolean(c.media.bannerUrl);
  const logo = Boolean(c.media.logoUrl);
  const rewardImage = Boolean(c.reward.imageUrl);
  const prizeTile = Boolean(c.reward.tileImageUrl ?? c.reward.imageUrl);

  const missing: string[] = [];
  if (!basicInfo) missing.push("Basic information");
  if (!reward) missing.push("Reward");
  if (!schedule) missing.push("Schedule (end date must be in the future)");
  if (!banner) missing.push("Offer banner");

  return {
    basicInfo,
    reward,
    schedule,
    banner,
    logo,
    rewardImage,
    prizeTile,
    canPublish: missing.length === 0,
    missing,
  };
}

export interface AdminCampaignDto {
  id: string;
  slug: string;
  name: string;
  merchantName: string;
  offerTitle: string;
  description: string;
  reward: Campaign["reward"];
  schedule: { startAt: string; endAt: string; validityLabel: string };
  media: Campaign["media"];
  settings: Campaign["settings"];
  status: Campaign["status"];
  lifecycle: CampaignLifecycle;
  isActive: boolean;
  sortOrder: number;
  stats: Campaign["stats"];
  winnerAnnouncedAt: string | null;
  publishReadiness: PublishReadiness;
  createdAt: string;
  updatedAt: string;
}

export function toAdminCampaignDto(c: CampaignRecord, now: Date): AdminCampaignDto {
  return {
    id: c._id.toString(),
    slug: c.slug,
    name: c.name,
    merchantName: c.merchantName,
    offerTitle: c.offerTitle,
    description: c.description,
    reward: {
      title: c.reward.title,
      imageUrl: c.reward.imageUrl ?? null,
      tileImageUrl: c.reward.tileImageUrl ?? null,
      winnerSelection: c.reward.winnerSelection,
      numberOfWinners: c.reward.numberOfWinners,
      rankingBasis: c.reward.rankingBasis,
    },
    schedule: {
      startAt: c.schedule.startAt.toISOString(),
      endAt: c.schedule.endAt.toISOString(),
      validityLabel: c.schedule.validityLabel,
    },
    media: { bannerUrl: c.media.bannerUrl ?? null, logoUrl: c.media.logoUrl ?? null },
    settings: c.settings,
    status: c.status,
    lifecycle: getCampaignLifecycle(c, now),
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    stats: c.stats,
    winnerAnnouncedAt: c.winnerAnnouncedAt?.toISOString() ?? null,
    publishReadiness: getPublishReadiness(c, now),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
