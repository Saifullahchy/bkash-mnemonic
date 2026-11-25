import type { Types } from "mongoose";
import { CampaignModel, type CampaignRecord } from "../../campaign/campaign.model.js";
import { ParticipantModel } from "../../participant/participant.model.js";
import { ShareEventModel } from "../../shareLink/shareEvent.model.js";
import { ShareLinkModel, type ShareLinkRecord } from "../../shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../tracking/linkOpen.model.js";
import { lifecycleFilter } from "../campaigns/adminCampaign.repository.js";

export interface DailyCount {
  campaignId: string;
  day: string;
  count: number;
}

/** Read-only aggregations for the admin dashboard. */
export class DashboardRepository {
  countParticipants(): Promise<number> {
    return ParticipantModel.estimatedDocumentCount().exec();
  }

  countNewParticipants(from: Date, to: Date): Promise<number> {
    return ParticipantModel.countDocuments({ firstLoginAt: { $gte: from, $lt: to } }).exec();
  }

  countShareEvents(from: Date, to: Date): Promise<number> {
    return ShareEventModel.countDocuments({ createdAt: { $gte: from, $lt: to } }).exec();
  }

  countCountedOpens(from: Date, to: Date): Promise<number> {
    return LinkOpenModel.countDocuments({
      counted: true,
      createdAt: { $gte: from, $lt: to },
    }).exec();
  }

  async campaignTotals(): Promise<{ shares: number; opens: number }> {
    const [row] = await CampaignModel.aggregate<{ shares: number; opens: number }>([
      { $group: { _id: null, shares: { $sum: "$stats.shares" }, opens: { $sum: "$stats.opens" } } },
    ]);
    return { shares: row?.shares ?? 0, opens: row?.opens ?? 0 };
  }

  liveCampaigns(now: Date): Promise<CampaignRecord[]> {
    return CampaignModel.find({ ...lifecycleFilter("live", now), isActive: true })
      .sort({ "stats.shares": -1 })
      .lean<CampaignRecord[]>()
      .exec();
  }

  /** Counted shares per campaign per Dhaka calendar day. */
  dailyShares(campaignIds: Types.ObjectId[], from: Date): Promise<DailyCount[]> {
    return ShareEventModel.aggregate<DailyCount>([
      { $match: { campaignId: { $in: campaignIds }, createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            campaignId: "$campaignId",
            day: {
              $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: "Asia/Dhaka" },
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          campaignId: { $toString: "$_id.campaignId" },
          day: "$_id.day",
          count: 1,
        },
      },
    ]);
  }

  /** Best-performing links across the given campaigns (frozen links excluded). */
  topLinks(campaignIds: Types.ObjectId[], limit: number): Promise<ShareLinkRecord[]> {
    return ShareLinkModel.find({ campaignId: { $in: campaignIds }, "flags.frozen": false })
      .sort({ opens: -1, shares: -1, lastOpenedAt: 1 })
      .limit(limit)
      .lean<ShareLinkRecord[]>()
      .exec();
  }

  async phonesFor(participantIds: Types.ObjectId[]): Promise<Map<string, string>> {
    const rows = await ParticipantModel.find({ _id: { $in: participantIds } }, { phone: 1 })
      .lean()
      .exec();
    return new Map(rows.map((r) => [r._id.toString(), r.phone]));
  }
}
