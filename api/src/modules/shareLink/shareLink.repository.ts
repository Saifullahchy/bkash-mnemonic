import { Types } from "mongoose";
import { ShareEventModel } from "./shareEvent.model.js";
import { ShareLinkModel, type ShareLinkRecord } from "./shareLink.model.js";

const oid = (id: string) => new Types.ObjectId(id);

export class ShareLinkRepository {
  findForParticipant(participantId: string, campaignId: string): Promise<ShareLinkRecord | null> {
    return ShareLinkModel.findOne({
      participantId: oid(participantId),
      campaignId: oid(campaignId),
    })
      .lean<ShareLinkRecord>()
      .exec();
  }

  findManyForParticipant(participantId: string, campaignIds: string[]): Promise<ShareLinkRecord[]> {
    return ShareLinkModel.find({
      participantId: oid(participantId),
      campaignId: { $in: campaignIds.map(oid) },
    })
      .lean<ShareLinkRecord[]>()
      .exec();
  }

  /** Throws a duplicate-key error (11000) on a code clash or an existing link. */
  async create(input: {
    participantId: string;
    campaignId: string;
    code: string;
  }): Promise<ShareLinkRecord> {
    const doc = await ShareLinkModel.create({
      participantId: oid(input.participantId),
      campaignId: oid(input.campaignId),
      code: input.code,
    });
    return doc.toObject<ShareLinkRecord>();
  }

  /**
   * Counts a share at most once per `windowMs` per link, atomically: the filter
   * only matches if the last counted share is older than the window, so
   * concurrent double-clicks can't both increment.
   */
  async recordShare(linkId: Types.ObjectId, now: Date, windowMs: number): Promise<boolean> {
    const result = await ShareLinkModel.updateOne(
      {
        _id: linkId,
        $or: [
          { lastSharedAt: null },
          { lastSharedAt: { $lte: new Date(now.getTime() - windowMs) } },
        ],
      },
      { $inc: { shares: 1 }, $set: { lastSharedAt: now } },
    ).exec();
    return result.modifiedCount === 1;
  }

  findByCode(code: string): Promise<ShareLinkRecord | null> {
    return ShareLinkModel.findOne({ code }).lean<ShareLinkRecord>().exec();
  }

  /** Atomic +1 on the link's unique-open counter. */
  async incrementOpens(linkId: Types.ObjectId, now: Date): Promise<void> {
    await ShareLinkModel.updateOne(
      { _id: linkId },
      { $inc: { opens: 1 }, $set: { lastOpenedAt: now } },
    ).exec();
  }

  async insertShareEvent(link: ShareLinkRecord, now: Date): Promise<void> {
    await ShareEventModel.create({
      shareLinkId: link._id,
      campaignId: link.campaignId,
      participantId: link.participantId,
      createdAt: now,
    });
  }
}
