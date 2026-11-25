import type { Types } from "mongoose";
import { LinkOpenModel, type OpenReason } from "./linkOpen.model.js";
import { UsedOpenTokenModel } from "./usedOpenToken.model.js";

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

export interface OpenRecordInput {
  shareLinkId: Types.ObjectId;
  campaignId: Types.ObjectId;
  ownerId: Types.ObjectId;
  visitorId: string;
  deviceHash: string;
  subnetHash: string;
  counted: boolean;
  reason: OpenReason;
}

/**
 * Opens that "used up" a person for a link: counted ones, and ones an admin later
 * voided. Voiding takes the opens off the score but must not let the same
 * browsers/devices open the link again and be counted afresh.
 */
const countedOrVoided = { $or: [{ counted: true }, { reason: "voided" as OpenReason }] };

export class TrackingRepository {
  /** Atomically marks a token nonce as used. false = it was already redeemed. */
  async consumeNonce(nonce: string, now: Date): Promise<boolean> {
    try {
      await UsedOpenTokenModel.create({ nonce, createdAt: now });
      return true;
    } catch (error) {
      if (isDuplicateKey(error)) return false;
      throw error;
    }
  }

  /** Was this link already counted (or counted then voided) for this browser OR this device? */
  async hasCountedOpen(
    linkId: Types.ObjectId,
    visitorId: string,
    deviceHash: string,
  ): Promise<boolean> {
    const found = await LinkOpenModel.exists({
      shareLinkId: linkId,
      $and: [countedOrVoided, { $or: [{ visitorId }, { deviceHash }] }],
    });
    return found !== null;
  }

  /**
   * How many different links in this campaign this browser/device has been
   * counted for — voided ones included, so a void doesn't free the phone up to
   * boost more links.
   */
  async countCountedLinksForDevice(
    campaignId: Types.ObjectId,
    visitorId: string,
    deviceHash: string,
  ): Promise<number> {
    const links = await LinkOpenModel.distinct("shareLinkId", {
      campaignId,
      $and: [countedOrVoided, { $or: [{ visitorId }, { deviceHash }] }],
    }).exec();
    return links.length;
  }

  countCountedFromSubnetSince(
    linkId: Types.ObjectId,
    subnetHash: string,
    since: Date,
  ): Promise<number> {
    return LinkOpenModel.countDocuments({
      shareLinkId: linkId,
      subnetHash,
      counted: true,
      createdAt: { $gte: since },
    }).exec();
  }

  countCountedSince(linkId: Types.ObjectId, since: Date): Promise<number> {
    return LinkOpenModel.countDocuments({
      shareLinkId: linkId,
      counted: true,
      createdAt: { $gte: since },
    }).exec();
  }

  /**
   * Inserts an open. For counted opens the partial unique indexes are the
   * final guard against concurrent duplicates: returns "duplicate" if lost.
   */
  async insertOpen(input: OpenRecordInput, now: Date): Promise<"inserted" | "duplicate"> {
    try {
      // createdAt comes from the injected clock (time-window caps depend on it).
      await new LinkOpenModel({ ...input, createdAt: now }).save({ timestamps: false });
      return "inserted";
    } catch (error) {
      if (input.counted && isDuplicateKey(error)) return "duplicate";
      throw error;
    }
  }
}
