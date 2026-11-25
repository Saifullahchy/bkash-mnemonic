import { Types } from "mongoose";
import { CampaignModel } from "../../campaign/campaign.model.js";
import { ParticipantModel } from "../../participant/participant.model.js";
import { ShareLinkModel, type ShareLinkRecord } from "../../shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../tracking/linkOpen.model.js";

export interface LinkActivityWindow {
  shareLinkId: Types.ObjectId;
  counted: number;
  /** Rejected for anything except plain duplicates (refreshes are normal). */
  blocked: number;
  countedLastHour: number;
  topSubnetCounted: number;
}

export class ModerationRepository {
  findLink(id: string): Promise<ShareLinkRecord | null> {
    return ShareLinkModel.findById(id).lean<ShareLinkRecord>().exec();
  }

  async setFrozenForParticipant(participantId: string, frozen: boolean): Promise<void> {
    await ShareLinkModel.updateMany(
      { participantId: new Types.ObjectId(participantId) },
      { $set: { "flags.frozen": frozen } },
    ).exec();
  }

  async setSuspicious(
    linkId: Types.ObjectId,
    suspicious: boolean,
    reason: string | null,
  ): Promise<boolean> {
    const result = await ShareLinkModel.updateOne(
      { _id: linkId, "flags.suspicious": !suspicious },
      { $set: { "flags.suspicious": suspicious, "flags.suspiciousReason": reason } },
    ).exec();
    return result.modifiedCount === 1;
  }

  /**
   * Voids every counted open of a link: marks them not counted (reason
   * "voided") and subtracts exactly that many from link, campaign and
   * participant counters. Returns how many were voided.
   */
  async voidCountedOpens(link: ShareLinkRecord): Promise<number> {
    const { modifiedCount } = await LinkOpenModel.updateMany(
      { shareLinkId: link._id, counted: true },
      { $set: { counted: false, reason: "voided" } },
    ).exec();
    if (modifiedCount > 0) {
      await Promise.all([
        ShareLinkModel.updateOne({ _id: link._id }, { $inc: { opens: -modifiedCount } }).exec(),
        CampaignModel.updateOne(
          { _id: link.campaignId },
          { $inc: { "stats.opens": -modifiedCount } },
        ).exec(),
        ParticipantModel.updateOne(
          { _id: link.participantId },
          { $inc: { "stats.opens": -modifiedCount } },
        ).exec(),
      ]);
    }
    return modifiedCount;
  }

  /** Per-link open statistics for the suspicion rules, over [since, now]. */
  linkActivitySince(since: Date, lastHour: Date): Promise<LinkActivityWindow[]> {
    return LinkOpenModel.aggregate<LinkActivityWindow>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { link: "$shareLinkId", subnet: "$subnetHash" },
          counted: { $sum: { $cond: ["$counted", 1, 0] } },
          blocked: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$counted", false] },
                    { $ne: ["$reason", "duplicate"] },
                    { $ne: ["$reason", "voided"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          countedLastHour: {
            $sum: { $cond: [{ $and: ["$counted", { $gte: ["$createdAt", lastHour] }] }, 1, 0] },
          },
        },
      },
      {
        $group: {
          _id: "$_id.link",
          counted: { $sum: "$counted" },
          blocked: { $sum: "$blocked" },
          countedLastHour: { $sum: "$countedLastHour" },
          topSubnetCounted: { $max: "$counted" },
        },
      },
      {
        $project: {
          _id: 0,
          shareLinkId: "$_id",
          counted: 1,
          blocked: 1,
          countedLastHour: 1,
          topSubnetCounted: 1,
        },
      },
    ]);
  }
}
