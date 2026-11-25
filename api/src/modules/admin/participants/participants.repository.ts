import { Types, type QueryFilter } from "mongoose";
import { CampaignModel } from "../../campaign/campaign.model.js";
import {
  ParticipantModel,
  type Participant,
  type ParticipantRecord,
} from "../../participant/participant.model.js";
import { ShareLinkModel, type ShareLinkRecord } from "../../shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../tracking/linkOpen.model.js";

export class ParticipantsRepository {
  list(
    filter: QueryFilter<Participant>,
    skip: number,
    limit: number,
  ): Promise<ParticipantRecord[]> {
    return ParticipantModel.find(filter)
      .sort({ "stats.shares": -1, firstLoginAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean<ParticipantRecord[]>()
      .exec();
  }

  count(filter: QueryFilter<Participant>): Promise<number> {
    return ParticipantModel.countDocuments(filter).exec();
  }

  countAll(): Promise<number> {
    return ParticipantModel.estimatedDocumentCount().exec();
  }

  countJoined(from: Date, to: Date): Promise<number> {
    return ParticipantModel.countDocuments({ firstLoginAt: { $gte: from, $lt: to } }).exec();
  }

  async totalShares(): Promise<number> {
    const [row] = await ParticipantModel.aggregate<{ shares: number }>([
      { $group: { _id: null, shares: { $sum: "$stats.shares" } } },
    ]);
    return row?.shares ?? 0;
  }

  findById(id: string): Promise<ParticipantRecord | null> {
    return ParticipantModel.findById(id).lean<ParticipantRecord>().exec();
  }

  async campaignNames(ids: Types.ObjectId[]): Promise<Map<string, string>> {
    const rows = await CampaignModel.find({ _id: { $in: ids } }, { merchantName: 1 })
      .lean()
      .exec();
    return new Map(rows.map((c) => [c._id.toString(), c.merchantName]));
  }

  /** Participants (among `ids`) with at least one link flagged suspicious. */
  async flaggedAmong(ids: Types.ObjectId[]): Promise<Set<string>> {
    const owners = await ShareLinkModel.distinct("participantId", {
      participantId: { $in: ids },
      "flags.suspicious": true,
    });
    return new Set(owners.map((o) => String(o)));
  }

  linksOf(participantId: string): Promise<ShareLinkRecord[]> {
    return ShareLinkModel.find({ participantId: new Types.ObjectId(participantId) })
      .sort({ createdAt: -1 })
      .lean<ShareLinkRecord[]>()
      .exec();
  }

  /** Not-counted open attempts per link and reason (why opens were rejected). */
  async rejectedByReason(linkIds: Types.ObjectId[]): Promise<Map<string, Record<string, number>>> {
    const rows = await LinkOpenModel.aggregate<{
      _id: { link: Types.ObjectId; reason: string };
      n: number;
    }>([
      { $match: { shareLinkId: { $in: linkIds }, counted: false } },
      { $group: { _id: { link: "$shareLinkId", reason: "$reason" }, n: { $sum: 1 } } },
    ]);
    const out = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const key = row._id.link.toString();
      out.set(key, { ...(out.get(key) ?? {}), [row._id.reason]: row.n });
    }
    return out;
  }

  async setStatus(
    id: string,
    status: "active" | "disqualified",
    reason: string | null,
  ): Promise<void> {
    await ParticipantModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { status, disqualifiedReason: reason } },
    ).exec();
  }
}
