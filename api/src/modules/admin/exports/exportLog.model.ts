import { Schema, model, type Types } from "mongoose";
import {
  EXPORT_TYPES,
  PARTICIPANT_COLUMNS,
  type ExportType,
  type ParticipantColumn,
} from "./exports.datasets.js";

/** "Export history": who downloaded what, when, with which filters (re-downloadable). */
export interface ExportLog {
  /** First (or only) dataset in the file. */
  type: ExportType;
  /** Every dataset in a custom (multi-sheet) export; empty for single-dataset files. */
  datasets: ExportType[];
  filename: string;
  rows: number;
  filters: {
    campaignId: Types.ObjectId | null;
    from: Date | null;
    to: Date | null;
    columns: ParticipantColumn[];
  };
  adminId: Types.ObjectId | null;
  adminName: string;
  /** "download" from the panel or "scheduled" email report. */
  source: "download" | "scheduled";
  createdAt: Date;
}

const exportLogSchema = new Schema<ExportLog>({
  type: { type: String, enum: EXPORT_TYPES, required: true },
  datasets: { type: [{ type: String, enum: EXPORT_TYPES }], default: [] },
  filename: { type: String, required: true },
  rows: { type: Number, required: true },
  filters: {
    campaignId: { type: Schema.Types.ObjectId, default: null },
    from: { type: Date, default: null },
    to: { type: Date, default: null },
    columns: { type: [{ type: String, enum: PARTICIPANT_COLUMNS }], default: [] },
  },
  adminId: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  adminName: { type: String, required: true },
  source: { type: String, enum: ["download", "scheduled"], default: "download" },
  createdAt: { type: Date, required: true },
});

exportLogSchema.index({ createdAt: -1 });

export const ExportLogModel = model<ExportLog>("ExportLog", exportLogSchema);
