import { Schema, model, type Types } from "mongoose";

export const ACTIVITY_TYPES = [
  "participant_joined",
  "campaign_created",
  "campaign_published",
  "campaign_unpublished",
  "campaign_paused",
  "campaign_activated",
  "campaign_deleted",
  "winners_announced",
  "participant_disqualified",
  "participant_reinstated",
  "opens_voided",
  "link_flagged",
  "terms_updated",
  "export_downloaded",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface Activity {
  type: ActivityType;
  /** Who did it: a participant (phone), an admin (name) or the system. */
  actor: { kind: "participant" | "admin" | "system"; id: Types.ObjectId | null; label: string };
  campaignId: Types.ObjectId | null;
  campaignName: string | null;
  /** Extra details, e.g. { reason } or { count }. */
  meta: Record<string, unknown>;
  createdAt: Date;
}

/** "Recent activity" feed. Kept 90 days (audit trail for admin actions is the main use). */
const activitySchema = new Schema<Activity>({
  type: { type: String, enum: ACTIVITY_TYPES, required: true },
  actor: {
    kind: { type: String, enum: ["participant", "admin", "system"], required: true },
    id: { type: Schema.Types.ObjectId, default: null },
    label: { type: String, required: true },
  },
  campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", default: null },
  campaignName: { type: String, default: null },
  meta: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, required: true },
});

activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ActivityModel = model<Activity>("Activity", activitySchema);
