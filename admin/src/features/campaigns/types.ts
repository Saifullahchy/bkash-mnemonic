/** Mirrors AdminCampaignDto in offer-finder-api. */
export type Lifecycle = "draft" | "scheduled" | "live" | "ended";
export type CampaignFilter = "all" | Lifecycle;
export type RankingBasis = "opens" | "shares";
export type MediaKind = "banner" | "reward-banner" | "prize-tile";

export interface AntiAbuseSettings {
  maxLinksPerDevice: number;
  maxOpensPerSubnetPerHour: number;
  maxOpensPerLinkPer10Min: number;
}

export interface AdminCampaign {
  id: string;
  slug: string;
  name: string;
  merchantName: string;
  offerTitle: string;
  description: string;
  reward: {
    title: string;
    /** Artwork for the app's whole reward banner; null → the app's built-in banner. */
    bannerImageUrl: string | null;
    /** Prize picture: shared-link tile and the built-in reward banner. */
    tileImageUrl: string | null;
    /** Older campaigns' prize picture: used when there is no `tileImageUrl`. */
    imageUrl: string | null;
    winnerSelection: "top_sharer";
    numberOfWinners: number;
    rankingBasis: RankingBasis;
  };
  schedule: { startAt: string; endAt: string; validityLabel: string };
  media: { bannerUrl: string | null; logoUrl: string | null };
  settings: {
    requirePhone: boolean;
    requireOtp: boolean;
    showOnHome: boolean;
    countLinkOpens: boolean;
    antiAbuse: AntiAbuseSettings;
  };
  status: "draft" | "published";
  lifecycle: Lifecycle;
  isActive: boolean;
  sortOrder: number;
  stats: { participants: number; shares: number; opens: number };
  winnerAnnouncedAt: string | null;
  publishReadiness: {
    basicInfo: boolean;
    reward: boolean;
    schedule: boolean;
    banner: boolean;
    logo: boolean;
    rewardImage: boolean;
    prizeTile: boolean;
    canPublish: boolean;
    missing: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CampaignListParams {
  status: CampaignFilter;
  search?: string;
  active?: "true" | "false";
  page: number;
  limit: number;
}

export interface CampaignList {
  items: AdminCampaign[];
  total: number;
  page: number;
  limit: number;
  counts: Record<CampaignFilter, number>;
}

/** Body for create (full) and update (partial) — see the API's zod schemas. */
export interface CampaignInput {
  name: string;
  merchantName: string;
  offerTitle: string;
  description: string;
  reward: { title: string; numberOfWinners: number; rankingBasis: RankingBasis };
  schedule: { startAt: string; endAt: string; validityLabel: string };
  settings: {
    requirePhone: boolean;
    showOnHome: boolean;
    countLinkOpens: boolean;
    antiAbuse: AntiAbuseSettings;
  };
}
