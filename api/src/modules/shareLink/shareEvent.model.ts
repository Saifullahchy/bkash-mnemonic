import { Schema, model, type Types } from "mongoose";

/**
 * One counted share (Copy / Share click, de-duplicated per minute). Feeds the
 * "Shares over time" chart; the per-link counter stays the fast path.
 */
export interface ShareEvent {
  shareLinkId: Types.ObjectId;
  campaignId: Types.ObjectId;
  participantId: Types.ObjectId;
  createdAt: Date;
}

const shareEventSchema = new Schema<ShareEvent>({
  shareLinkId: { type: Schema.Types.ObjectId, ref: "ShareLink", required: true },
  campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
  participantId: { type: Schema.Types.ObjectId, ref: "Participant", required: true },
  createdAt: { type: Date, required: true },
});

shareEventSchema.index({ campaignId: 1, createdAt: -1 });
shareEventSchema.index({ createdAt: -1 });

export const ShareEventModel = model<ShareEvent>("ShareEvent", shareEventSchema);
