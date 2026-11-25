import { Schema, model, type Types } from "mongoose";

/** Why an open was (not) counted — every attempt is kept for the audit trail. */
export const OPEN_REASONS = [
  "counted",
  "duplicate",
  "self_open",
  "bot",
  "invalid_token",
  "rate_limited",
  "device_cap",
  "subnet_cap",
  "velocity_cap",
  "campaign_inactive",
  "link_frozen",
  /** Was counted, later voided by an admin (moderation). */
  "voided",
] as const;
export type OpenReason = (typeof OPEN_REASONS)[number];

export interface LinkOpen {
  shareLinkId: Types.ObjectId;
  campaignId: Types.ObjectId;
  ownerId: Types.ObjectId;
  visitorId: string;
  deviceHash: string;
  subnetHash: string;
  counted: boolean;
  reason: OpenReason;
}

const linkOpenSchema = new Schema<LinkOpen>(
  {
    shareLinkId: { type: Schema.Types.ObjectId, ref: "ShareLink", required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "Participant", required: true },

    /** First-party visitor cookie (UUID). */
    visitorId: { type: String, required: true },
    /** sha256(ip + user-agent + accept-language + salt) — raw IPs are never stored. */
    deviceHash: { type: String, required: true },
    /** Salted hash of the /24 (IPv4) or /64 (IPv6) network. */
    subnetHash: { type: String, required: true },

    counted: { type: Boolean, required: true },
    reason: { type: String, enum: OPEN_REASONS, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/*
 * Dedup guarantees, enforced atomically by MongoDB: a link can be counted at
 * most once per browser AND at most once per device fingerprint. Partial so
 * rejected attempts can still be logged any number of times.
 */
linkOpenSchema.index(
  { shareLinkId: 1, visitorId: 1 },
  { unique: true, partialFilterExpression: { counted: true }, name: "uniq_counted_link_visitor" },
);
linkOpenSchema.index(
  { shareLinkId: 1, deviceHash: 1 },
  { unique: true, partialFilterExpression: { counted: true }, name: "uniq_counted_link_device" },
);
// Caps: how many different links one device/visitor counted for in a campaign.
linkOpenSchema.index({ campaignId: 1, deviceHash: 1, counted: 1 });
linkOpenSchema.index({ campaignId: 1, visitorId: 1, counted: 1 });
// Caps: opens per subnet per link in a time window; velocity per link.
linkOpenSchema.index({ shareLinkId: 1, subnetHash: 1, createdAt: -1 });
linkOpenSchema.index({ shareLinkId: 1, counted: 1, createdAt: -1 });
// Exports / dashboard: counted opens in a date range.
linkOpenSchema.index({ counted: 1, createdAt: -1 });
// Rejected attempts are audit data only: keep them 30 days. Counted opens are kept forever.
linkOpenSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { counted: false } },
);

export type LinkOpenRecord = LinkOpen & { _id: Types.ObjectId; createdAt: Date };

export const LinkOpenModel = model<LinkOpen>("LinkOpen", linkOpenSchema);
