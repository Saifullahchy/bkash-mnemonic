export type KpiRange = "7d" | "30d";
export type ChartRange = "7d" | "30d" | "all";

export interface ActivityItem {
  id: string;
  type: string;
  actor: { kind: "participant" | "admin" | "system"; label: string };
  campaignName: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface Dashboard {
  range: KpiRange;
  kpis: {
    liveCampaigns: { value: number; total: number };
    participants: { value: number; changePct: number };
    shares: { value: number; changePct: number };
    opens: { value: number; changePct: number };
  };
  chart: {
    range: ChartRange;
    days: string[];
    series: { campaignId: string; label: string; values: number[] }[];
  };
  liveCampaigns: {
    id: string;
    name: string;
    merchantName: string;
    endAt: string;
    participants: number;
    shares: number;
    sharePct: number;
  }[];
  counts: { scheduled: number; draft: number; ended: number };
  topSharers: {
    rank: number;
    participantId: string;
    phone: string;
    campaignId: string;
    campaignName: string;
    shares: number;
    opens: number;
  }[];
  activity: ActivityItem[];
}
