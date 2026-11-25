export type ParticipantStatus = "active" | "idle" | "disqualified";

export interface ParticipantRow {
  id: string;
  phone: string;
  firstLoginAt: string;
  lastActiveAt: string;
  campaigns: { id: string; name: string }[];
  shares: number;
  opens: number;
  status: ParticipantStatus;
  flagged: boolean;
}

export interface ParticipantSummary {
  total: number;
  totalChangePct: number;
  newToday: number;
  newTodayChangePct: number;
  avgSharesPerUser: number;
}

export interface ParticipantList {
  items: ParticipantRow[];
  total: number;
  page: number;
  limit: number;
  summary: ParticipantSummary;
}

export interface ParticipantLink {
  shareLinkId: string;
  campaign: { id: string; name: string };
  code: string;
  opens: number;
  shares: number;
  lastSharedAt: string | null;
  lastOpenedAt: string | null;
  flags: { suspicious: boolean; suspiciousReason: string | null; frozen: boolean };
  rejectedOpens: Record<string, number>;
}

export interface ParticipantDetail extends ParticipantRow {
  disqualifiedReason: string | null;
  links: ParticipantLink[];
}

export interface ParticipantListParams {
  search?: string;
  campaignId?: string;
  activeWithin: "7d" | "30d" | "all";
  status: "all" | ParticipantStatus;
  page: number;
  limit: number;
}
