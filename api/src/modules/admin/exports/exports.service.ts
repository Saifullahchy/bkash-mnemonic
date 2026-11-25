import type { Writable } from "node:stream";
import { Types } from "mongoose";
import { logger } from "../../../config/logger.js";
import { NotFoundError } from "../../../core/errors/AppError.js";
import type { Clock } from "../../../core/utils/clock.js";
import { slugify } from "../../../core/utils/slug.js";
import type { ActivityActor, ActivityService } from "../../activity/activity.service.js";
import { CampaignModel } from "../../campaign/campaign.model.js";
import { ParticipantModel } from "../../participant/participant.model.js";
import { ShareEventModel } from "../../shareLink/shareEvent.model.js";
import { LinkOpenModel } from "../../tracking/linkOpen.model.js";
import { ExportLogModel } from "./exportLog.model.js";
import { DATASETS, type ExportFilters, type ExportType } from "./exports.datasets.js";
import { workbookBuffer, writeWorkbook } from "./xlsx.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ExportHistoryItem {
  id: string;
  type: ExportType;
  datasets: ExportType[];
  filename: string;
  rows: number;
  adminName: string;
  source: "download" | "scheduled";
  createdAt: string;
}

export class ExportsService {
  constructor(
    private readonly activity: ActivityService,
    private readonly clock: Clock,
  ) {}

  /**
   * e.g. participants_foodi_05-Nov.xlsx (as in the design's history list);
   * a multi-dataset custom export is custom_export_foodi_05-Nov.xlsx.
   */
  async filenameFor(type: ExportType | "custom", filters: ExportFilters): Promise<string> {
    const now = new Date(this.clock.now().getTime() + 6 * 3600_000); // Dhaka date
    const day = `${String(now.getUTCDate()).padStart(2, "0")}-${MONTHS[now.getUTCMonth()]}`;
    let scope = "all";
    if (filters.campaignId) {
      const c = await CampaignModel.findById(filters.campaignId, { merchantName: 1 }).lean().exec();
      scope = c ? slugify(c.merchantName) : "campaign";
    }
    const prefix = type === "custom" ? "custom_export" : type.replace("-", "_");
    return `${prefix}_${scope}_${day}.xlsx`;
  }

  /**
   * Streams an export into `target` (the HTTP response), then records it in the
   * history + activity feed. Returns the row count.
   */
  async stream(
    types: ExportType[],
    filters: ExportFilters,
    target: Writable,
    actor: ActivityActor & { id: string },
    filename: string,
  ): Promise<number> {
    const rows = await writeWorkbook(target, this.sheets(types, filters));
    await this.record(types, filters, filename, rows, actor, "download");
    return rows;
  }

  /** All sheets of the given datasets, in order, in one workbook. */
  private async *sheets(types: ExportType[], filters: ExportFilters) {
    const now = this.clock.now();
    for (const type of types) yield* DATASETS[type].sheets(filters, now);
  }

  /** The same export as a Buffer (email attachments). */
  async buffer(type: ExportType, filters: ExportFilters) {
    return workbookBuffer(DATASETS[type].sheets(filters, this.clock.now()));
  }

  async record(
    typeOrTypes: ExportType | ExportType[],
    filters: ExportFilters,
    filename: string,
    rows: number,
    actor: ActivityActor,
    source: "download" | "scheduled",
  ) {
    const types = Array.isArray(typeOrTypes) ? typeOrTypes : [typeOrTypes];
    try {
      await ExportLogModel.create({
        type: types[0],
        datasets: types.length > 1 ? types : [],
        filename,
        rows,
        filters: {
          campaignId: filters.campaignId ? new Types.ObjectId(filters.campaignId) : null,
          from: filters.from ?? null,
          to: filters.to ?? null,
          columns: filters.columns ?? [],
        },
        adminId:
          actor.kind === "admin" && actor.id ? new Types.ObjectId(actor.id.toString()) : null,
        adminName: actor.label,
        source,
        createdAt: this.clock.now(),
      });
      await this.activity.record("export_downloaded", actor, { meta: { filename, rows } });
    } catch (error) {
      logger.error({ err: error }, "Failed to record export");
    }
  }

  async history(limit: number): Promise<ExportHistoryItem[]> {
    const rows = await ExportLogModel.find().sort({ createdAt: -1 }).limit(limit).lean().exec();
    return rows.map((r) => ({
      id: r._id.toString(),
      type: r.type,
      datasets: r.datasets?.length ? r.datasets : [r.type],
      filename: r.filename,
      rows: r.rows,
      adminName: r.adminName,
      source: r.source,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Filters of a past export, to download it again with fresh data. */
  async historyFilters(id: string): Promise<{ types: ExportType[]; filters: ExportFilters }> {
    const log = await ExportLogModel.findById(id).lean().exec();
    if (!log) throw new NotFoundError("Export");
    return {
      types: log.datasets?.length ? log.datasets : [log.type],
      filters: {
        ...(log.filters.campaignId ? { campaignId: log.filters.campaignId.toString() } : {}),
        ...(log.filters.from ? { from: log.filters.from } : {}),
        ...(log.filters.to ? { to: log.filters.to } : {}),
        ...(log.filters.columns?.length ? { columns: log.filters.columns } : {}),
      },
    };
  }

  /** Row counts shown on the export cards. */
  async summary() {
    const now = this.clock.now();
    const [participants, shareActivity, linkOpens, leaderboards, campaigns] = await Promise.all([
      ParticipantModel.estimatedDocumentCount().exec(),
      ShareEventModel.estimatedDocumentCount().exec(),
      LinkOpenModel.countDocuments({ counted: true }).exec(),
      CampaignModel.countDocuments({
        status: "published",
        "schedule.startAt": { $lte: now },
      }).exec(),
      CampaignModel.estimatedDocumentCount().exec(),
    ]);
    return { participants, shareActivity, linkOpens, leaderboards, campaigns };
  }
}
