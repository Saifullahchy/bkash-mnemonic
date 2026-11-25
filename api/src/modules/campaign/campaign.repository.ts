import { Types } from "mongoose";
import { CampaignModel, type CampaignRecord } from "./campaign.model.js";

export type CampaignCounter = "participants" | "shares" | "opens";

/** Data access for campaigns. The only layer that talks to Mongoose. */
export class CampaignRepository {
  /** Published, active, home-visible campaigns whose date window contains `now`. */
  findLiveForHome(now: Date): Promise<CampaignRecord[]> {
    return CampaignModel.find({
      status: "published",
      isActive: true,
      "settings.showOnHome": true,
      "schedule.startAt": { $lte: now },
      "schedule.endAt": { $gt: now },
    })
      .sort({ sortOrder: 1, "schedule.endAt": 1 })
      .lean<CampaignRecord[]>()
      .exec();
  }

  /** A published + active campaign by id, regardless of dates (caller decides). */
  findPublishedById(id: string): Promise<CampaignRecord | null> {
    return CampaignModel.findOne({ _id: id, status: "published", isActive: true })
      .lean<CampaignRecord>()
      .exec();
  }

  /** Atomic counter bump on the denormalised campaign stats. */
  async incrementStat(campaignId: string, counter: CampaignCounter, by = 1): Promise<void> {
    await CampaignModel.updateOne(
      { _id: new Types.ObjectId(campaignId) },
      { $inc: { [`stats.${counter}`]: by } },
    ).exec();
  }
}
