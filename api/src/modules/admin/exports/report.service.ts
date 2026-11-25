import { logger } from "../../../config/logger.js";
import { AppError } from "../../../core/errors/AppError.js";
import type { Mailer } from "../../../core/mail/mailer.js";
import type { Clock } from "../../../core/utils/clock.js";
import { nextDhakaRun } from "../../../core/utils/time.js";
import { SYSTEM_ACTOR } from "../../activity/activity.service.js";
import { DATASETS } from "./exports.datasets.js";
import type { ExportsService } from "./exports.service.js";
import {
  ReportScheduleModel,
  type ReportDataset,
  type ReportFrequency,
  type ReportSchedule,
} from "./reportSchedule.model.js";

export interface ReportScheduleDto {
  enabled: boolean;
  frequency: ReportFrequency;
  datasets: ReportDataset[];
  recipients: string[];
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "sent" | "failed" | null;
  lastError: string | null;
  /** "smtp" sends real email; "outbox" writes it to a folder (development). */
  delivery: "smtp" | "outbox";
}

const DEFAULTS = {
  enabled: false,
  frequency: "weekly" as const,
  datasets: ["participants", "leaderboard"] as ReportDataset[],
  recipients: [],
};

/** "Scheduled report": emails selected exports on a fixed schedule (09:00 Bangladesh time). */
export class ReportService {
  constructor(
    private readonly exports: ExportsService,
    private readonly mailer: Mailer,
    private readonly delivery: "smtp" | "outbox",
    private readonly clock: Clock,
  ) {}

  async get(): Promise<ReportScheduleDto> {
    const s = await ReportScheduleModel.findOne({ key: "default" }).lean<ReportSchedule>().exec();
    return this.toDto(
      s ?? { ...DEFAULTS, nextRunAt: null, lastRunAt: null, lastStatus: null, lastError: null },
    );
  }

  async save(
    input: {
      enabled: boolean;
      frequency: ReportFrequency;
      datasets: ReportDataset[];
      recipients: string[];
    },
    adminName: string,
  ) {
    if (input.enabled && input.recipients.length === 0) {
      throw new AppError("Add at least one email address", 400, "VALIDATION_ERROR", [
        { path: "recipients", message: "Add at least one email address" },
      ]);
    }
    const nextRunAt = input.enabled ? nextDhakaRun(this.clock.now(), input.frequency) : null;
    const saved = await ReportScheduleModel.findOneAndUpdate(
      { key: "default" },
      { $set: { ...input, nextRunAt, updatedByName: adminName } },
      { upsert: true, new: true },
    )
      .lean<ReportSchedule>()
      .exec();
    return this.toDto(saved);
  }

  /**
   * Runs the report if it is due. The next run is claimed atomically first, so
   * several API instances (or overlapping timers) never send it twice.
   */
  async runDue(): Promise<boolean> {
    const now = this.clock.now();
    const current = await ReportScheduleModel.findOne({
      key: "default",
      enabled: true,
      nextRunAt: { $lte: now },
    })
      .lean<ReportSchedule>()
      .exec();
    if (!current) return false;
    const claimed = await ReportScheduleModel.findOneAndUpdate(
      { key: "default", enabled: true, nextRunAt: current.nextRunAt },
      { $set: { nextRunAt: nextDhakaRun(now, current.frequency) } },
    ).exec();
    if (!claimed) return false;
    await this.send(current);
    return true;
  }

  /** "Send now" from the admin panel (uses the saved recipients and datasets). */
  async sendNow(): Promise<ReportScheduleDto> {
    const s = await ReportScheduleModel.findOne({ key: "default" }).lean<ReportSchedule>().exec();
    if (!s || s.recipients.length === 0)
      throw new AppError("Save a schedule with recipients first", 400, "VALIDATION_ERROR");
    await this.send(s);
    return this.get();
  }

  private async send(schedule: ReportSchedule): Promise<void> {
    const now = this.clock.now();
    try {
      const attachments = [];
      for (const type of schedule.datasets) {
        const filename = await this.exports.filenameFor(type, {});
        const { buffer, rows } = await this.exports.buffer(type, {});
        attachments.push({ filename, content: buffer });
        await this.exports.record(
          type,
          {},
          filename,
          rows,
          { ...SYSTEM_ACTOR, label: "Scheduled report" },
          "scheduled",
        );
      }
      await this.mailer.send({
        to: schedule.recipients,
        subject: `Offer campaigns report — ${schedule.datasets.map((d) => DATASETS[d].label).join(" + ")}`,
        text: `Attached: ${attachments.map((a) => a.filename).join(", ")}.\n\nSent automatically by Mnemonic Offer Admin.`,
        attachments,
      });
      await ReportScheduleModel.updateOne(
        { key: "default" },
        { $set: { lastRunAt: now, lastStatus: "sent", lastError: null } },
      );
    } catch (error) {
      logger.error({ err: error }, "Scheduled report failed");
      await ReportScheduleModel.updateOne(
        { key: "default" },
        {
          $set: {
            lastRunAt: now,
            lastStatus: "failed",
            lastError: error instanceof Error ? error.message : "Unknown error",
          },
        },
      );
      throw new AppError("The report could not be sent", 502, "REPORT_FAILED");
    }
  }

  private toDto(
    s: Pick<
      ReportSchedule,
      | "enabled"
      | "frequency"
      | "datasets"
      | "recipients"
      | "nextRunAt"
      | "lastRunAt"
      | "lastStatus"
      | "lastError"
    >,
  ): ReportScheduleDto {
    return {
      enabled: s.enabled,
      frequency: s.frequency,
      datasets: s.datasets,
      recipients: s.recipients,
      nextRunAt: s.nextRunAt?.toISOString() ?? null,
      lastRunAt: s.lastRunAt?.toISOString() ?? null,
      lastStatus: s.lastStatus ?? null,
      lastError: s.lastError ?? null,
      delivery: this.delivery,
    };
  }
}
