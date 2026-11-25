import type { Types } from "mongoose";
import { logger } from "../../config/logger.js";
import type { Clock } from "../../core/utils/clock.js";
import { ActivityModel, type Activity, type ActivityType } from "./activity.model.js";

export interface ActivityActor {
  kind: Activity["actor"]["kind"];
  id?: Types.ObjectId | string | null;
  label: string;
}

export interface ActivityDto {
  id: string;
  type: ActivityType;
  actor: { kind: Activity["actor"]["kind"]; label: string };
  campaignName: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export const SYSTEM_ACTOR: ActivityActor = { kind: "system", label: "System" };

/**
 * Records notable events for the dashboard's "Recent activity" feed and the
 * admin audit trail. Logging must never break the action being logged, so
 * failures are reported and swallowed.
 */
export class ActivityService {
  constructor(private readonly clock: Clock) {}

  async record(
    type: ActivityType,
    actor: ActivityActor,
    options: {
      campaign?: { id: Types.ObjectId | string; name: string } | null;
      meta?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    try {
      await ActivityModel.create({
        type,
        actor: { kind: actor.kind, id: actor.id ?? null, label: actor.label },
        campaignId: options.campaign?.id ?? null,
        campaignName: options.campaign?.name ?? null,
        meta: options.meta ?? {},
        createdAt: this.clock.now(),
      });
    } catch (error) {
      logger.error({ err: error, type }, "Failed to record activity");
    }
  }

  async recent(limit: number): Promise<ActivityDto[]> {
    const rows = await ActivityModel.find().sort({ createdAt: -1 }).limit(limit).lean().exec();
    return rows.map((row) => ({
      id: row._id.toString(),
      type: row.type,
      actor: { kind: row.actor.kind, label: row.actor.label },
      campaignName: row.campaignName ?? null,
      meta: row.meta ?? {},
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
