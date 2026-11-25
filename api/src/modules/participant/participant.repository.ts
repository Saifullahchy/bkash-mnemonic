import { isValidObjectId, Types } from "mongoose";
import { ParticipantModel, type ParticipantRecord } from "./participant.model.js";

/** Keep only the most recent visitor ids per participant (bounded document size). */
export const MAX_BOUND_VISITORS = 20;

/** Pipeline expression: move `value` to the end of the array field, keeping the last N. */
function appendCapped(field: string, value: string | undefined) {
  const existing = { $ifNull: [field, []] };
  if (!value) return existing;
  return {
    $slice: [
      {
        $concatArrays: [
          { $filter: { input: existing, cond: { $ne: ["$$this", value] } } },
          [value],
        ],
      },
      -MAX_BOUND_VISITORS,
    ],
  };
}

export class ParticipantRepository {
  /** Participants who logged in or shared since `since`. */
  countActiveSince(since: Date): Promise<number> {
    return ParticipantModel.countDocuments({ lastActiveAt: { $gte: since } }).exec();
  }

  findById(id: string): Promise<ParticipantRecord | null> {
    if (!isValidObjectId(id)) return Promise.resolve(null);
    return ParticipantModel.findById(id).lean<ParticipantRecord>().exec();
  }

  /**
   * Atomic "find or create" on login, in one round trip and race-free under
   * concurrent logins (unique phone index). Also records the visitor cookie and
   * device fingerprint (self-open detection), de-duplicated and capped to the
   * latest MAX_BOUND_VISITORS each, via an update pipeline.
   */
  async upsertOnLogin(
    phone: string,
    now: Date,
    binding: { visitorId?: string; deviceHash?: string } = {},
  ): Promise<ParticipantRecord> {
    const result = await ParticipantModel.collection.findOneAndUpdate(
      { phone },
      [
        {
          $set: {
            phone,
            phoneVerified: { $ifNull: ["$phoneVerified", false] },
            status: { $ifNull: ["$status", "active"] },
            disqualifiedReason: { $ifNull: ["$disqualifiedReason", null] },
            firstLoginAt: { $ifNull: ["$firstLoginAt", now] },
            campaignIds: { $ifNull: ["$campaignIds", []] },
            stats: { $ifNull: ["$stats", { shares: 0, opens: 0, campaigns: 0 }] },
            lastActiveAt: now,
            visitorIds: appendCapped("$visitorIds", binding.visitorId),
            deviceHashes: appendCapped("$deviceHashes", binding.deviceHash),
            createdAt: { $ifNull: ["$createdAt", now] },
            updatedAt: now,
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );
    if (!result) throw new Error("Participant upsert returned no document");
    return result as unknown as ParticipantRecord;
  }

  async touch(id: string, now: Date): Promise<void> {
    await ParticipantModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { lastActiveAt: now } },
    ).exec();
  }

  /** Atomic $inc on the participant's denormalised totals (may be negative when voiding). */
  async incrementStats(
    id: Types.ObjectId | string,
    delta: { shares?: number; opens?: number },
  ): Promise<void> {
    const inc: Record<string, number> = {};
    if (delta.shares) inc["stats.shares"] = delta.shares;
    if (delta.opens) inc["stats.opens"] = delta.opens;
    if (Object.keys(inc).length === 0) return;
    await ParticipantModel.updateOne(
      { _id: new Types.ObjectId(id.toString()) },
      { $inc: inc },
    ).exec();
  }

  /** Records that the participant joined a campaign; counts it once (idempotent). */
  async addCampaign(id: string, campaignId: string): Promise<void> {
    const campaign = new Types.ObjectId(campaignId);
    await ParticipantModel.updateOne(
      { _id: new Types.ObjectId(id), campaignIds: { $ne: campaign } },
      { $push: { campaignIds: campaign }, $inc: { "stats.campaigns": 1 } },
    ).exec();
  }
}
