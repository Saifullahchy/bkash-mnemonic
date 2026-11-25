/**
 * DEV ONLY — realistic sharing activity for the live campaigns so the admin
 * dashboard, leaderboard and participants screens have something to show:
 * participants, links, counted (and some rejected) opens, share events over
 * the last 3 weeks, plus one link with a suspicious single-network pattern.
 *
 *   npm run seed:demo            (refuses if real-looking data already exists)
 *   npm run seed:demo -- --force
 */
import { randomBytes } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env, isProduction } from "../config/env.js";
import { logger } from "../config/logger.js";
import { randomBase62, SHARE_CODE_LENGTH } from "../core/utils/codeGenerator.js";
import { ActivityModel } from "../modules/activity/activity.model.js";
import { CampaignModel, type CampaignRecord } from "../modules/campaign/campaign.model.js";
import { ParticipantModel } from "../modules/participant/participant.model.js";
import { ShareEventModel } from "../modules/shareLink/shareEvent.model.js";
import { ShareLinkModel } from "../modules/shareLink/shareLink.model.js";
import { LinkOpenModel } from "../modules/tracking/linkOpen.model.js";
import { rebuildCounters } from "./lib/rebuildCounters.js";

const DAY = 24 * 60 * 60 * 1000;
const PARTICIPANTS = 160;

/** Deterministic PRNG so the demo looks the same on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261123);
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)]!;
const hash = () => randomBytes(16).toString("base64url");
const uuid = () => crypto.randomUUID();

async function main(): Promise<void> {
  if (isProduction) throw new Error("seed:demo is for local development only");
  await connectDatabase(env.MONGODB_URI);
  await mongoose.connection.syncIndexes();

  if ((await ParticipantModel.countDocuments()) > 20 && !process.argv.includes("--force")) {
    throw new Error("Participants already exist; pass --force to add demo activity anyway");
  }

  const now = Date.now();
  const live = await CampaignModel.find({
    status: "published",
    isActive: true,
    "schedule.startAt": { $lte: new Date(now) },
    "schedule.endAt": { $gt: new Date(now) },
  }).lean<CampaignRecord[]>();
  if (live.length === 0) throw new Error("No live campaigns — run `npm run seed` first");

  const subnets = Array.from({ length: 400 }, hash);
  const participants = [];
  const used = new Set((await ParticipantModel.find({}, { phone: 1 }).lean()).map((p) => p.phone));
  while (participants.length < PARTICIPANTS) {
    const phone = `01${pick(["3", "4", "5", "6", "7", "8", "9"])}${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`;
    if (used.has(phone)) continue;
    used.add(phone);
    const firstLoginAt = new Date(now - rand() * 28 * DAY);
    participants.push({
      _id: new Types.ObjectId(),
      phone,
      firstLoginAt,
      lastActiveAt: firstLoginAt,
      phoneVerified: false,
      status: "active",
      visitorIds: [uuid()],
      deviceHashes: [hash()],
    });
  }
  await ParticipantModel.insertMany(participants);

  const links = [];
  const opens = [];
  const shares = [];
  for (const p of participants) {
    const joined = live.filter(() => rand() < 0.65);
    for (const campaign of joined.length ? joined : [pick(live)]) {
      const start = Math.max(
        campaign.schedule.startAt.getTime(),
        p.firstLoginAt.getTime(),
        now - 21 * DAY,
      );
      const linkId = new Types.ObjectId();
      const openCount = Math.floor(Math.pow(rand(), 3.2) * 160);
      const shareCount = Math.max(1, Math.round(openCount / (2 + rand() * 3)));
      const at = () => new Date(start + rand() * (now - start));
      let lastOpenedAt: Date | null = null;
      let lastSharedAt: Date | null = null;

      for (let i = 0; i < openCount; i++) {
        const createdAt = at();
        if (!lastOpenedAt || createdAt > lastOpenedAt) lastOpenedAt = createdAt;
        opens.push({
          shareLinkId: linkId,
          campaignId: campaign._id,
          ownerId: p._id,
          visitorId: uuid(),
          deviceHash: hash(),
          subnetHash: pick(subnets),
          counted: true,
          reason: "counted",
          createdAt,
        });
        if (rand() < 0.15)
          opens.push({
            shareLinkId: linkId,
            campaignId: campaign._id,
            ownerId: p._id,
            visitorId: uuid(),
            deviceHash: hash(),
            subnetHash: pick(subnets),
            counted: false,
            reason: pick(["duplicate", "duplicate", "self_open", "invalid_token"]),
            createdAt: at(),
          });
      }
      for (let i = 0; i < shareCount; i++) {
        const createdAt = at();
        if (!lastSharedAt || createdAt > lastSharedAt) lastSharedAt = createdAt;
        shares.push({
          shareLinkId: linkId,
          campaignId: campaign._id,
          participantId: p._id,
          createdAt,
        });
      }
      links.push({
        _id: linkId,
        campaignId: campaign._id,
        participantId: p._id,
        code: randomBase62(SHARE_CODE_LENGTH),
        opens: 0,
        shares: 0,
        lastOpenedAt,
        lastSharedAt,
        flags: { suspicious: false, suspiciousReason: null, frozen: false },
      });
      const lastActive = [lastOpenedAt, lastSharedAt]
        .filter(Boolean)
        .sort((a, b) => b!.getTime() - a!.getTime())[0];
      if (lastActive && lastActive > p.lastActiveAt) p.lastActiveAt = lastActive;
    }
  }

  // One farm-like link: a burst of opens from a single network in the last few hours.
  const farm = links[0]!;
  const farmSubnet = hash();
  for (let i = 0; i < 40; i++) {
    opens.push({
      shareLinkId: farm._id,
      campaignId: farm.campaignId,
      ownerId: farm.participantId,
      visitorId: uuid(),
      deviceHash: hash(),
      subnetHash: farmSubnet,
      counted: i < 25,
      reason: i < 25 ? "counted" : "subnet_cap",
      createdAt: new Date(now - rand() * 3 * 3600_000),
    });
  }

  await ShareLinkModel.insertMany(links);
  await LinkOpenModel.insertMany(opens, { ordered: false });
  await ShareEventModel.insertMany(shares);
  await ParticipantModel.bulkWrite(
    participants.map((p) => ({
      updateOne: { filter: { _id: p._id }, update: { $set: { lastActiveAt: p.lastActiveAt } } },
    })),
  );
  await ActivityModel.insertMany(
    [...participants]
      .sort((a, b) => b.firstLoginAt.getTime() - a.firstLoginAt.getTime())
      .slice(0, 8)
      .map((p) => ({
        type: "participant_joined",
        actor: { kind: "participant", id: p._id, label: p.phone },
        campaignId: null,
        campaignName: null,
        meta: {},
        createdAt: p.firstLoginAt,
      })),
  );

  const counters = await rebuildCounters();
  logger.info(
    {
      participants: participants.length,
      links: links.length,
      opens: opens.length,
      shares: shares.length,
      counters,
    },
    "Demo activity seeded",
  );
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, "Demo seed failed");
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
