import { Schema, model, type Types } from "mongoose";

/** One personal link per (participant, campaign): offer-finder.com/s/{code}. */
export interface ShareLink {
  campaignId: Types.ObjectId;
  participantId: Types.ObjectId;
  code: string;
  opens: number;
  shares: number;
  lastSharedAt: Date | null;
  lastOpenedAt: Date | null;
  flags: { suspicious: boolean; suspiciousReason: string | null; frozen: boolean };
}

const shareLinkSchema = new Schema<ShareLink>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    participantId: { type: Schema.Types.ObjectId, ref: "Participant", required: true },
    /** Random 8-char base62 code — unguessable and unrelated to the phone number. */
    code: { type: String, required: true, match: /^[0-9A-Za-z]{8}$/ },

    /** Unique counted opens (source of truth: LinkOpen where counted=true). */
    opens: { type: Number, default: 0, min: 0 },
    /** Share/copy clicks by the owner. */
    shares: { type: Number, default: 0, min: 0 },
    lastSharedAt: { type: Date, default: null },
    lastOpenedAt: { type: Date, default: null },

    flags: {
      suspicious: { type: Boolean, default: false },
      suspiciousReason: { type: String, default: null },
      frozen: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);

shareLinkSchema.index({ code: 1 }, { unique: true });
shareLinkSchema.index({ campaignId: 1, participantId: 1 }, { unique: true });
shareLinkSchema.index({ participantId: 1 });
// Leaderboards: ranked by opens or shares inside a campaign; the full sort key (incl. _id
// tie-break) is indexed so each page is read in order instead of sorted in memory.
shareLinkSchema.index({ campaignId: 1, opens: -1, lastOpenedAt: 1, _id: 1 });
shareLinkSchema.index({ campaignId: 1, shares: -1, lastSharedAt: 1, _id: 1 });

export type ShareLinkRecord = ShareLink & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export const ShareLinkModel = model<ShareLink>("ShareLink", shareLinkSchema);
