import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { ParticipantModel } from "../../src/modules/participant/participant.model.js";
import { ShareEventModel } from "../../src/modules/shareLink/shareEvent.model.js";
import { ShareLinkModel } from "../../src/modules/shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../src/modules/tracking/linkOpen.model.js";
import { NOW } from "./factories.js";

let n = 0;

export async function participant(
  overrides: {
    phone?: string;
    lastActiveAt?: Date;
    firstLoginAt?: Date;
    status?: "active" | "disqualified";
  } = {},
) {
  n += 1;
  return ParticipantModel.create({
    phone: overrides.phone ?? `0181${String(n).padStart(7, "0")}`,
    firstLoginAt: overrides.firstLoginAt ?? NOW,
    lastActiveAt: overrides.lastActiveAt ?? NOW,
    status: overrides.status ?? "active",
  });
}

interface LinkOptions {
  opens?: number;
  shares?: number;
  lastOpenedAt?: Date;
  frozen?: boolean;
  suspicious?: boolean;
}

/** A share link with consistent counters on link, participant and campaign. */
export async function linkFor(
  campaignId: Types.ObjectId,
  participantId: Types.ObjectId,
  o: LinkOptions = {},
) {
  n += 1;
  const link = await ShareLinkModel.create({
    campaignId,
    participantId,
    code: `L${String(n).padStart(7, "0")}`,
    opens: o.opens ?? 0,
    shares: o.shares ?? 0,
    lastOpenedAt: o.lastOpenedAt ?? NOW,
    lastSharedAt: NOW,
    flags: {
      suspicious: o.suspicious ?? false,
      suspiciousReason: o.suspicious ? "Test flag" : null,
      frozen: o.frozen ?? false,
    },
  });
  await ParticipantModel.updateOne(
    { _id: participantId },
    {
      $inc: { "stats.opens": o.opens ?? 0, "stats.shares": o.shares ?? 0, "stats.campaigns": 1 },
      $push: { campaignIds: campaignId },
    },
  );
  return link;
}

/** Real counted LinkOpen records (for void / scan / rebuild tests). */
export async function countedOpens(
  link: { _id: Types.ObjectId; campaignId: Types.ObjectId; participantId: Types.ObjectId },
  count: number,
  options: { subnetHash?: string; createdAt?: Date; counted?: boolean; reason?: string } = {},
) {
  await LinkOpenModel.insertMany(
    Array.from({ length: count }, () => ({
      shareLinkId: link._id,
      campaignId: link.campaignId,
      ownerId: link.participantId,
      visitorId: randomUUID(),
      deviceHash: randomUUID(),
      subnetHash: options.subnetHash ?? randomUUID(),
      counted: options.counted ?? true,
      reason: options.reason ?? "counted",
      createdAt: options.createdAt ?? NOW,
    })),
  );
}

export async function shareEvents(
  link: { _id: Types.ObjectId; campaignId: Types.ObjectId; participantId: Types.ObjectId },
  dates: Date[],
) {
  await ShareEventModel.insertMany(
    dates.map((createdAt) => ({
      shareLinkId: link._id,
      campaignId: link.campaignId,
      participantId: link.participantId,
      createdAt,
    })),
  );
}
