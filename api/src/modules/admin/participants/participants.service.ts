import { Types, type QueryFilter } from "mongoose";
import { AppError, NotFoundError } from "../../../core/errors/AppError.js";
import type { Clock } from "../../../core/utils/clock.js";
import { DAY_MS, percentChange } from "../../../core/utils/stats.js";
import { startOfDhakaDay } from "../../../core/utils/time.js";
import type { ActivityActor, ActivityService } from "../../activity/activity.service.js";
import type { Participant, ParticipantRecord } from "../../participant/participant.model.js";
import type { ModerationRepository } from "../moderation/moderation.repository.js";
import type { ParticipantsRepository } from "./participants.repository.js";

/** "Active" = logged in or shared within this window; otherwise "Idle". */
export const ACTIVE_WINDOW_MS = 7 * DAY_MS;

export type ParticipantStatus = "active" | "idle" | "disqualified";

export interface ParticipantRow {
  id: string;
  phone: string;
  firstLoginAt: string;
  lastActiveAt: string;
  campaigns: { id: string; name: string }[];
  shares: number;
  opens: number;
  status: ParticipantStatus;
  flagged: boolean;
}

export interface ParticipantListQuery {
  search?: string;
  campaignId?: string;
  activeWithin: "7d" | "30d" | "all";
  status: "all" | ParticipantStatus;
  page: number;
  limit: number;
}

export class ParticipantsService {
  constructor(
    private readonly repo: ParticipantsRepository,
    private readonly moderation: ModerationRepository,
    private readonly activity: ActivityService,
    private readonly clock: Clock,
  ) {}

  async list(q: ParticipantListQuery) {
    const now = this.clock.now();
    const filter: QueryFilter<Participant> = {};
    const digits = q.search?.replace(/\D/g, "");
    if (digits) filter.phone = { $regex: digits };
    if (q.campaignId) filter.campaignIds = new Types.ObjectId(q.campaignId);
    if (q.activeWithin !== "all") {
      filter.lastActiveAt = {
        $gte: new Date(now.getTime() - (q.activeWithin === "7d" ? 7 : 30) * DAY_MS),
      };
    }
    const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MS);
    if (q.status === "disqualified") filter.status = "disqualified";
    if (q.status === "active")
      Object.assign(filter, { status: "active", lastActiveAt: { $gte: activeSince } });
    if (q.status === "idle")
      Object.assign(filter, { status: "active", lastActiveAt: { $lt: activeSince } });

    const [rows, total, summary] = await Promise.all([
      this.repo.list(filter, (q.page - 1) * q.limit, q.limit),
      this.repo.count(filter),
      this.summary(now),
    ]);
    const ids = rows.map((r) => r._id);
    const [names, flagged] = await Promise.all([
      this.repo.campaignNames(
        [...new Set(rows.flatMap((r) => r.campaignIds.map(String)))].map(
          (id) => new Types.ObjectId(id),
        ),
      ),
      this.repo.flaggedAmong(ids),
    ]);

    return {
      items: rows.map((r) => this.toRow(r, names, flagged, activeSince)),
      total,
      page: q.page,
      limit: q.limit,
      summary,
    };
  }

  /** Header KPIs: totals with change vs the previous period. */
  private async summary(now: Date) {
    const today = startOfDhakaDay(now);
    const yesterday = new Date(today.getTime() - DAY_MS);
    const month = new Date(now.getTime() - 30 * DAY_MS);
    const prevMonth = new Date(now.getTime() - 60 * DAY_MS);
    const end = new Date(now.getTime() + 1); // windows include "now"
    const [total, joinedToday, joinedYesterday, joinedMonth, joinedPrevMonth, shares] =
      await Promise.all([
        this.repo.countAll(),
        this.repo.countJoined(today, end),
        this.repo.countJoined(yesterday, today),
        this.repo.countJoined(month, end),
        this.repo.countJoined(prevMonth, month),
        this.repo.totalShares(),
      ]);
    return {
      total,
      totalChangePct: percentChange(joinedMonth, joinedPrevMonth),
      newToday: joinedToday,
      newTodayChangePct: percentChange(joinedToday, joinedYesterday),
      avgSharesPerUser: total ? Math.round((shares / total) * 10) / 10 : 0,
    };
  }

  async detail(id: string) {
    const participant = await this.require(id);
    const links = await this.repo.linksOf(id);
    const [names, rejected] = await Promise.all([
      this.repo.campaignNames(links.map((l) => l.campaignId)),
      this.repo.rejectedByReason(links.map((l) => l._id)),
    ]);
    const activeSince = new Date(this.clock.now().getTime() - ACTIVE_WINDOW_MS);
    const flagged = new Set(links.some((l) => l.flags.suspicious) ? [id] : []);
    return {
      ...this.toRow(participant, names, flagged, activeSince),
      disqualifiedReason: participant.disqualifiedReason ?? null,
      links: links.map((l) => ({
        shareLinkId: l._id.toString(),
        campaign: { id: l.campaignId.toString(), name: names.get(l.campaignId.toString()) ?? "" },
        code: l.code,
        opens: l.opens,
        shares: l.shares,
        lastSharedAt: l.lastSharedAt?.toISOString() ?? null,
        lastOpenedAt: l.lastOpenedAt?.toISOString() ?? null,
        flags: {
          suspicious: l.flags.suspicious,
          suspiciousReason: l.flags.suspiciousReason ?? null,
          frozen: l.flags.frozen,
        },
        rejectedOpens: rejected.get(l._id.toString()) ?? {},
      })),
    };
  }

  /** Removes the participant from every leaderboard and stops counting their links. */
  async disqualify(id: string, reason: string, actor: ActivityActor) {
    const participant = await this.require(id);
    if (participant.status === "disqualified")
      throw new AppError("Already disqualified", 409, "ALREADY_DISQUALIFIED");
    await this.repo.setStatus(id, "disqualified", reason);
    await this.moderation.setFrozenForParticipant(id, true);
    await this.activity.record("participant_disqualified", actor, {
      meta: { phone: participant.phone, reason },
    });
    return this.detail(id);
  }

  async reinstate(id: string, actor: ActivityActor) {
    const participant = await this.require(id);
    if (participant.status !== "disqualified")
      throw new AppError("Participant is not disqualified", 409, "NOT_DISQUALIFIED");
    await this.repo.setStatus(id, "active", null);
    await this.moderation.setFrozenForParticipant(id, false);
    await this.activity.record("participant_reinstated", actor, {
      meta: { phone: participant.phone },
    });
    return this.detail(id);
  }

  private toRow(
    r: ParticipantRecord,
    names: Map<string, string>,
    flagged: Set<string>,
    activeSince: Date,
  ): ParticipantRow {
    const status: ParticipantStatus =
      r.status === "disqualified"
        ? "disqualified"
        : r.lastActiveAt >= activeSince
          ? "active"
          : "idle";
    return {
      id: r._id.toString(),
      phone: r.phone,
      firstLoginAt: r.firstLoginAt.toISOString(),
      lastActiveAt: r.lastActiveAt.toISOString(),
      campaigns: (r.campaignIds ?? []).map((c) => ({
        id: c.toString(),
        name: names.get(c.toString()) ?? "",
      })),
      shares: r.stats?.shares ?? 0,
      opens: r.stats?.opens ?? 0,
      status,
      flagged: flagged.has(r._id.toString()),
    };
  }

  private async require(id: string): Promise<ParticipantRecord> {
    const p = await this.repo.findById(id);
    if (!p) throw new NotFoundError("Participant");
    return p;
  }
}
