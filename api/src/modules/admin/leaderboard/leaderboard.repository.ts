import { Types, type QueryFilter } from "mongoose";
import { CampaignModel, type CampaignWinner } from "../../campaign/campaign.model.js";
import { ParticipantModel } from "../../participant/participant.model.js";
import {
  ShareLinkModel,
  type ShareLink,
  type ShareLinkRecord,
} from "../../shareLink/shareLink.model.js";

export type RankingBasis = "opens" | "shares";

/**
 * Leaderboard order: score desc, then whoever reached it first (earlier last
 * activity), then link age — a deterministic, explainable tie-break.
 * Frozen links (disqualified owners) never rank.
 */
const tieField = (basis: RankingBasis) => (basis === "opens" ? "lastOpenedAt" : "lastSharedAt");
const sortFor = (basis: RankingBasis) => ({ [basis]: -1, [tieField(basis)]: 1, _id: 1 }) as const;

export class LeaderboardRepository {
  private rankedFilter(campaignId: string): QueryFilter<ShareLink> {
    return { campaignId: new Types.ObjectId(campaignId), "flags.frozen": false };
  }

  page(
    campaignId: string,
    basis: RankingBasis,
    skip: number,
    limit: number,
  ): Promise<ShareLinkRecord[]> {
    return ShareLinkModel.find(this.rankedFilter(campaignId))
      .sort(sortFor(basis))
      .skip(skip)
      .limit(limit)
      .lean<ShareLinkRecord[]>()
      .exec();
  }

  countRanked(campaignId: string): Promise<number> {
    return ShareLinkModel.countDocuments(this.rankedFilter(campaignId)).exec();
  }

  /** 1-based rank of a link (score-based; ties share the better rank). */
  async rankOf(link: ShareLinkRecord, basis: RankingBasis): Promise<number> {
    const ahead = await ShareLinkModel.countDocuments({
      ...this.rankedFilter(link.campaignId.toString()),
      [basis]: { $gt: link[basis] },
    }).exec();
    return ahead + 1;
  }

  /** Links in the campaign whose owner's phone contains the digits searched. */
  async searchByPhone(
    campaignId: string,
    digits: string,
    limit: number,
  ): Promise<ShareLinkRecord[]> {
    const owners = await ParticipantModel.find({ phone: { $regex: digits } }, { _id: 1 })
      .limit(200)
      .lean()
      .exec();
    if (owners.length === 0) return [];
    return ShareLinkModel.find({
      ...this.rankedFilter(campaignId),
      participantId: { $in: owners.map((o) => o._id) },
    })
      .limit(limit)
      .lean<ShareLinkRecord[]>()
      .exec();
  }

  async phonesFor(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    const rows = await ParticipantModel.find({ _id: { $in: ids } }, { phone: 1 })
      .lean()
      .exec();
    return new Map(rows.map((r) => [r._id.toString(), r.phone]));
  }

  /** Writes winners once; returns false if they were already announced (race-safe). */
  async saveWinners(campaignId: string, winners: CampaignWinner[], now: Date): Promise<boolean> {
    const result = await CampaignModel.updateOne(
      { _id: new Types.ObjectId(campaignId), winnerAnnouncedAt: null },
      { $set: { winners, winnerAnnouncedAt: now } },
    ).exec();
    return result.modifiedCount === 1;
  }
}
