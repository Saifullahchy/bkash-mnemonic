import { Schema, model } from "mongoose";

export const REPORT_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number];
export const REPORT_DATASETS = [
  "participants",
  "leaderboard",
  "share-activity",
  "link-opens",
] as const;
export type ReportDataset = (typeof REPORT_DATASETS)[number];

/** Single "Scheduled report" setting (key = "default"). */
export interface ReportSchedule {
  key: "default";
  enabled: boolean;
  frequency: ReportFrequency;
  datasets: ReportDataset[];
  recipients: string[];
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastStatus: "sent" | "failed" | null;
  lastError: string | null;
  updatedByName: string | null;
}

const reportScheduleSchema = new Schema<ReportSchedule>(
  {
    key: { type: String, enum: ["default"], required: true },
    enabled: { type: Boolean, default: false },
    frequency: { type: String, enum: REPORT_FREQUENCIES, default: "weekly" },
    datasets: { type: [String], enum: REPORT_DATASETS, default: ["participants", "leaderboard"] },
    recipients: { type: [String], default: [] },
    nextRunAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    lastStatus: { type: String, enum: ["sent", "failed", null], default: null },
    lastError: { type: String, default: null },
    updatedByName: { type: String, default: null },
  },
  { timestamps: true },
);

reportScheduleSchema.index({ key: 1 }, { unique: true });

export const ReportScheduleModel = model<ReportSchedule>("ReportSchedule", reportScheduleSchema);
