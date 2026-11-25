import { Schema, model, type Types } from "mongoose";

export const PARTICIPANT_STATUS = ["active", "disqualified"] as const;

export interface Participant {
  phone: string;
  phoneVerified: boolean;
  status: (typeof PARTICIPANT_STATUS)[number];
  disqualifiedReason: string | null;
  firstLoginAt: Date;
  lastActiveAt: Date;
  visitorIds: string[];
  deviceHashes: string[];
  /** Campaigns this participant has a share link for. */
  campaignIds: Types.ObjectId[];
  /** Denormalised totals across all campaigns (kept in sync with $inc). */
  stats: { shares: number; opens: number; campaigns: number };
}

/** A person identified by their Bangladeshi mobile number (normalised 01XXXXXXXXX). */
const participantSchema = new Schema<Participant>(
  {
    phone: { type: String, required: true, match: /^01[3-9]\d{8}$/ },
    /** Stays false until OTP verification is switched on. */
    phoneVerified: { type: Boolean, default: false },
    status: { type: String, enum: PARTICIPANT_STATUS, default: "active" },
    disqualifiedReason: { type: String, default: null },

    firstLoginAt: { type: Date, required: true },
    lastActiveAt: { type: Date, required: true },

    /**
     * Visitor cookies / device hashes seen while this participant was logged in.
     * Opens coming from them never count on their own links (self-open rule).
     * Capped in the service layer to keep documents small.
     */
    visitorIds: { type: [String], default: [] },
    deviceHashes: { type: [String], default: [] },

    campaignIds: { type: [Schema.Types.ObjectId], ref: "Campaign", default: [] },
    stats: {
      shares: { type: Number, default: 0, min: 0 },
      opens: { type: Number, default: 0, min: 0 },
      campaigns: { type: Number, default: 0, min: 0 },
    },
  },
  { timestamps: true },
);

participantSchema.index({ phone: 1 }, { unique: true });
participantSchema.index({ lastActiveAt: -1 });
participantSchema.index({ visitorIds: 1 });
participantSchema.index({ deviceHashes: 1 });
// Admin Participants list: most active first, filter by campaign / signup date.
participantSchema.index({ "stats.shares": -1, firstLoginAt: -1 });
participantSchema.index({ campaignIds: 1, "stats.shares": -1 });
participantSchema.index({ firstLoginAt: -1 });

export type ParticipantRecord = Participant & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ParticipantModel = model<Participant>("Participant", participantSchema);
