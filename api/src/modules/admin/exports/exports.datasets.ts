import { Types } from "mongoose";
import { getCampaignLifecycle } from "../../campaign/campaign.domain.js";
import { CampaignModel, type CampaignRecord } from "../../campaign/campaign.model.js";
import { ParticipantModel } from "../../participant/participant.model.js";
import { ShareEventModel } from "../../shareLink/shareEvent.model.js";
import { ShareLinkModel } from "../../shareLink/shareLink.model.js";
import { LinkOpenModel } from "../../tracking/linkOpen.model.js";
import { dhakaCell, type CellValue, type SheetColumn, type SheetSource } from "./xlsx.js";

export const EXPORT_TYPES = [
  "participants",
  "share-activity",
  "link-opens",
  "leaderboard",
  "campaigns",
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

/** Columns of the Participants sheet that a custom export can pick (in sheet order). */
export const PARTICIPANT_COLUMNS = [
  "phone",
  "first",
  "last",
  "status",
  "campaigns",
  "shares",
  "opens",
] as const;
export type ParticipantColumn = (typeof PARTICIPANT_COLUMNS)[number];

export interface ExportFilters {
  campaignId?: string;
  from?: Date;
  to?: Date;
  /** Participants sheet only: which columns to include (all when omitted). */
  columns?: ParticipantColumn[];
}

const DATE_TIME = "dd mmm yyyy hh:mm";
const DATE = "dd mmm yyyy";
const NUMBER = "#,##0";

const range = (f: ExportFilters) =>
  f.from || f.to
    ? { ...(f.from ? { $gte: f.from } : {}), ...(f.to ? { $lt: f.to } : {}) }
    : undefined;

async function campaignNames(): Promise<Map<string, string>> {
  const rows = await CampaignModel.find({}, { merchantName: 1 }).lean().exec();
  return new Map(rows.map((c) => [c._id.toString(), c.merchantName]));
}

/** Shapes returned by the export aggregations (aggregation cursors are untyped). */
interface EventRow {
  createdAt: Date;
  campaignId: Types.ObjectId;
  phone?: string;
}
interface RankRow {
  opens: number;
  shares: number;
  lastSharedAt: Date | null;
  flags: { suspicious: boolean };
  phone?: string;
}

/** Turns a Mongo cursor/aggregation stream into spreadsheet rows. */
async function* mapRows<T>(
  source: AsyncIterable<T>,
  toRow: (doc: T) => CellValue[],
): AsyncIterable<CellValue[]> {
  for await (const doc of source) yield toRow(doc);
}

async function* participantsSheets(f: ExportFilters, _now: Date): AsyncIterable<SheetSource> {
  const names = await campaignNames();
  const filter: Record<string, unknown> = {};
  if (f.campaignId) filter.campaignIds = new Types.ObjectId(f.campaignId);
  const joined = range(f);
  if (joined) filter.firstLoginAt = joined;

  const all: (SheetColumn & { key: ParticipantColumn })[] = [
    { header: "Phone number", key: "phone", width: 16 },
    { header: "First login", key: "first", width: 20, numFmt: DATE_TIME },
    { header: "Last active", key: "last", width: 20, numFmt: DATE_TIME },
    { header: "Status", key: "status", width: 14 },
    { header: "Campaigns", key: "campaigns", width: 30 },
    { header: "Shares", key: "shares", width: 10, numFmt: NUMBER },
    { header: "Link opens", key: "opens", width: 12, numFmt: NUMBER },
  ];
  // Custom exports may pick a subset of columns; order stays as above.
  const keep = all.map((c) => !f.columns?.length || f.columns.includes(c.key));
  const columns = all.filter((_, i) => keep[i]);
  const cursor = ParticipantModel.find(filter).sort({ firstLoginAt: 1 }).lean().cursor();
  yield {
    name: "Participants",
    columns,
    rows: mapRows(cursor, (p) =>
      [
        p.phone,
        dhakaCell(p.firstLoginAt),
        dhakaCell(p.lastActiveAt),
        p.status === "disqualified" ? "Disqualified" : "Active",
        (p.campaignIds ?? [])
          .map((id) => names.get(id.toString()) ?? "")
          .filter(Boolean)
          .join(", "),
        p.stats?.shares ?? 0,
        p.stats?.opens ?? 0,
      ].filter((_, i) => keep[i]),
    ),
  };
}

async function* shareActivitySheets(f: ExportFilters, _now: Date): AsyncIterable<SheetSource> {
  const names = await campaignNames();
  const match: Record<string, unknown> = {};
  if (f.campaignId) match.campaignId = new Types.ObjectId(f.campaignId);
  const when = range(f);
  if (when) match.createdAt = when;

  const cursor = ShareEventModel.aggregate<EventRow>([
    { $match: match },
    { $sort: { createdAt: 1 } },
    {
      $lookup: {
        from: "participants",
        localField: "participantId",
        foreignField: "_id",
        as: "p",
        pipeline: [{ $project: { phone: 1 } }],
      },
    },
    { $project: { createdAt: 1, campaignId: 1, phone: { $first: "$p.phone" } } },
  ]).cursor();
  yield {
    name: "Share activity",
    columns: [
      { header: "Shared at", key: "at", width: 20, numFmt: DATE_TIME },
      { header: "Phone number", key: "phone", width: 16 },
      { header: "Campaign", key: "campaign", width: 18 },
    ],
    rows: mapRows(cursor as AsyncIterable<EventRow>, (e) => [
      dhakaCell(e.createdAt),
      e.phone ?? "",
      names.get(e.campaignId.toString()) ?? "",
    ]),
  };
}

async function* linkOpensSheets(f: ExportFilters, _now: Date): AsyncIterable<SheetSource> {
  const names = await campaignNames();
  const match: Record<string, unknown> = { counted: true };
  if (f.campaignId) match.campaignId = new Types.ObjectId(f.campaignId);
  const when = range(f);
  if (when) match.createdAt = when;

  const cursor = LinkOpenModel.aggregate<EventRow>([
    { $match: match },
    { $sort: { createdAt: 1 } },
    {
      $lookup: {
        from: "participants",
        localField: "ownerId",
        foreignField: "_id",
        as: "o",
        pipeline: [{ $project: { phone: 1 } }],
      },
    },
    { $project: { createdAt: 1, campaignId: 1, phone: { $first: "$o.phone" } } },
  ]).cursor();
  yield {
    name: "Link opens",
    columns: [
      { header: "Opened at", key: "at", width: 20, numFmt: DATE_TIME },
      { header: "Campaign", key: "campaign", width: 18 },
      { header: "Shared by (phone)", key: "phone", width: 18 },
    ],
    rows: mapRows(cursor as AsyncIterable<EventRow>, (o) => [
      dhakaCell(o.createdAt),
      names.get(o.campaignId.toString()) ?? "",
      o.phone ?? "",
    ]),
  };
}

/** One sheet per campaign that has started, ranked like the admin leaderboard. */
async function* leaderboardSheets(f: ExportFilters, now: Date): AsyncIterable<SheetSource> {
  const campaigns = await CampaignModel.find(
    f.campaignId
      ? { _id: new Types.ObjectId(f.campaignId) }
      : { status: "published", "schedule.startAt": { $lte: now } },
  )
    .sort({ "schedule.startAt": -1 })
    .lean<CampaignRecord[]>()
    .exec();

  for (const campaign of campaigns) {
    const basis = campaign.reward.rankingBasis;
    const tie = basis === "opens" ? "lastOpenedAt" : "lastSharedAt";
    const cursor = ShareLinkModel.aggregate<RankRow>([
      { $match: { campaignId: campaign._id, "flags.frozen": false } },
      { $sort: { [basis]: -1, [tie]: 1, _id: 1 } },
      {
        $lookup: {
          from: "participants",
          localField: "participantId",
          foreignField: "_id",
          as: "p",
          pipeline: [{ $project: { phone: 1 } }],
        },
      },
      {
        $project: { opens: 1, shares: 1, lastSharedAt: 1, flags: 1, phone: { $first: "$p.phone" } },
      },
    ]).cursor();
    let rank = 0;
    yield {
      name: `${campaign.merchantName} (${getCampaignLifecycle(campaign, now)})`,
      columns: [
        { header: "Rank", key: "rank", width: 8 },
        { header: "Phone number", key: "phone", width: 16 },
        { header: "Shares", key: "shares", width: 10, numFmt: NUMBER },
        { header: "Link opens", key: "opens", width: 12, numFmt: NUMBER },
        { header: "Opens per share", key: "ops", width: 16, numFmt: "0.00" },
        { header: "Last shared", key: "last", width: 20, numFmt: DATE_TIME },
        { header: "Flagged", key: "flagged", width: 10 },
      ],
      rows: mapRows(cursor as AsyncIterable<RankRow>, (l) => [
        ++rank,
        l.phone ?? "",
        l.shares,
        l.opens,
        l.shares ? Math.round((l.opens / l.shares) * 100) / 100 : l.opens,
        dhakaCell(l.lastSharedAt),
        l.flags.suspicious ? "Yes" : "",
      ]),
    };
  }
}

function* campaignsSheets(_f: ExportFilters, now: Date): Iterable<SheetSource> {
  const cursor = CampaignModel.find().sort({ createdAt: -1 }).lean<CampaignRecord[]>().cursor();
  yield {
    name: "Campaigns",
    columns: [
      { header: "Campaign", key: "name", width: 26 },
      { header: "Merchant", key: "merchant", width: 16 },
      { header: "Offer title", key: "offer", width: 32 },
      { header: "Status", key: "status", width: 12 },
      { header: "Active", key: "active", width: 8 },
      { header: "Start", key: "start", width: 14, numFmt: DATE },
      { header: "End (last day)", key: "end", width: 14, numFmt: DATE },
      { header: "Reward", key: "reward", width: 24 },
      { header: "Participants", key: "participants", width: 13, numFmt: NUMBER },
      { header: "Shares", key: "shares", width: 10, numFmt: NUMBER },
      { header: "Link opens", key: "opens", width: 12, numFmt: NUMBER },
    ],
    rows: mapRows(cursor, (c: CampaignRecord) => [
      c.name,
      c.merchantName,
      c.offerTitle,
      getCampaignLifecycle(c, now),
      c.isActive ? "Yes" : "No",
      dhakaCell(c.schedule.startAt),
      dhakaCell(new Date(c.schedule.endAt.getTime() - 1)),
      c.reward.title,
      c.stats.participants,
      c.stats.shares,
      c.stats.opens,
    ]),
  };
}

export const DATASETS: Record<
  ExportType,
  {
    label: string;
    sheets: (f: ExportFilters, now: Date) => AsyncIterable<SheetSource> | Iterable<SheetSource>;
  }
> = {
  participants: { label: "Participants", sheets: participantsSheets },
  "share-activity": { label: "Share activity", sheets: shareActivitySheets },
  "link-opens": { label: "Link opens", sheets: linkOpensSheets },
  leaderboard: { label: "Leaderboard", sheets: leaderboardSheets },
  campaigns: { label: "Campaigns", sheets: campaignsSheets },
};
