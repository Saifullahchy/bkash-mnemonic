import { baseApi } from "@/store/baseApi";

export type ExportType =
  "participants" | "share-activity" | "link-opens" | "leaderboard" | "campaigns";
export type ReportDataset = "participants" | "leaderboard" | "share-activity" | "link-opens";
export type ReportFrequency = "daily" | "weekly" | "monthly";

export interface ExportSummary {
  participants: number;
  shareActivity: number;
  linkOpens: number;
  leaderboards: number;
  campaigns: number;
}

export interface ExportHistoryItem {
  id: string;
  type: ExportType;
  /** Every dataset in the file (several for a custom export). */
  datasets: ExportType[];
  filename: string;
  rows: number;
  adminName: string;
  source: "download" | "scheduled";
  createdAt: string;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: ReportFrequency;
  datasets: ReportDataset[];
  recipients: string[];
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "sent" | "failed" | null;
  lastError: string | null;
  delivery: "smtp" | "outbox";
}

export const exportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getExportSummary: build.query<ExportSummary, void>({
      query: () => "/admin/exports/summary",
      providesTags: ["Exports"],
    }),
    getExportHistory: build.query<ExportHistoryItem[], void>({
      query: () => "/admin/exports/history",
      providesTags: ["Exports"],
    }),
    getReportSchedule: build.query<ReportSchedule, void>({
      query: () => "/admin/exports/schedule",
      providesTags: ["Exports"],
    }),
    saveReportSchedule: build.mutation<
      ReportSchedule,
      Pick<ReportSchedule, "enabled" | "frequency" | "datasets" | "recipients">
    >({
      query: (body) => ({ url: "/admin/exports/schedule", method: "PUT", body }),
      invalidatesTags: ["Exports"],
    }),
    sendReportNow: build.mutation<ReportSchedule, void>({
      query: () => ({ url: "/admin/exports/schedule/send-now", method: "POST" }),
      invalidatesTags: ["Exports"],
    }),
  }),
});

export const {
  useGetExportSummaryQuery,
  useGetExportHistoryQuery,
  useGetReportScheduleQuery,
  useSaveReportScheduleMutation,
  useSendReportNowMutation,
} = exportsApi;
