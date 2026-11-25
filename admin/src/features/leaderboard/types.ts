import type { Lifecycle } from "@/features/campaigns/types";

export interface LeaderboardRow {
  rank: number;
  shareLinkId: string;
  participantId: string;
  phone: string;
  shares: number;
  opens: number;
  opensPerShare: number;
  lastSharedAt: string | null;
  lastOpenedAt: string | null;
  suspicious: boolean;
  suspiciousReason: string | null;
}

export interface LeaderboardCampaign {
  id: string;
  name: string;
  merchantName: string;
  rewardTitle: string;
  numberOfWinners: number;
  rankingBasis: "opens" | "shares";
  endAt: string;
  lifecycle: Lifecycle;
  stats: { participants: number; shares: number; opens: number };
  winnerAnnouncedAt: string | null;
  winners: { rank: number; participantId: string; phone: string; opens: number; shares: number }[];
}

export interface Leaderboard {
  campaign: LeaderboardCampaign;
  items: LeaderboardRow[];
  total: number;
  page: number;
  limit: number;
}
