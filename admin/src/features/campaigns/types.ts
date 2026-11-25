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
    /** Prize picture in the app's reward banner. */
    imageUrl: string | null;
    /** Prize picture in the shared-link page's tile (falls back to `imageUrl`). */
    tileImageUrl: string | null;
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
