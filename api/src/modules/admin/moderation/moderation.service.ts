import { AppError, NotFoundError } from "../../../core/errors/AppError.js";
import type { Clock } from "../../../core/utils/clock.js";
import { DAY_MS } from "../../../core/utils/stats.js";
import {
  SYSTEM_ACTOR,
  type ActivityActor,
  type ActivityService,
} from "../../activity/activity.service.js";
import type { ModerationRepository, LinkActivityWindow } from "./moderation.repository.js";

/**
 * Rules that mark a link "suspicious" for human review (nothing is removed
 * automatically). Tuned to ignore normal behaviour like refreshes.
 */
export const SUSPICION_RULES = {
  /** Many blocked attempts (caps, bad tokens…) vs real opens in 24h. */
  blockedMin: 20,
  blockedRatio: 2,
  /** Burst: counted opens in the last hour. */
  burstLastHour: 30,
  /** One network produced most opens (min volume so small links aren't flagged). */
  subnetShare: 0.6,
  subnetMinCounted: 15,
};

export function suspicionReason(w: LinkActivityWindow): string | null {
  const r = SUSPICION_RULES;
  if (w.blocked >= r.blockedMin && w.blocked >= r.blockedRatio * Math.max(1, w.counted)) {
    return `Many blocked open attempts (${w.blocked} blocked vs ${w.counted} counted in 24h)`;
  }
  if (w.countedLastHour >= r.burstLastHour)
    return `Unusual spike (${w.countedLastHour} opens in the last hour)`;
  if (w.counted >= r.subnetMinCounted && w.topSubnetCounted / w.counted >= r.subnetShare) {
    return `Most opens come from one network (${w.topSubnetCounted} of ${w.counted} in 24h)`;
  }
  return null;
}

export class ModerationService {
  constructor(
    private readonly repo: ModerationRepository,
    private readonly activity: ActivityService,
    private readonly clock: Clock,
  ) {}

  /** Scans the last 24h of opens and flags links that match a rule. Returns how many were newly flagged. */
  async scan(): Promise<number> {
    const now = this.clock.now();
    const windows = await this.repo.linkActivitySince(
      new Date(now.getTime() - DAY_MS),
      new Date(now.getTime() - 3600_000),
    );
    let flagged = 0;
    for (const w of windows) {
      const reason = suspicionReason(w);
      if (!reason) continue;
      if (await this.repo.setSuspicious(w.shareLinkId, true, reason)) {
        flagged++;
        await this.activity.record("link_flagged", SYSTEM_ACTOR, {
          meta: { shareLinkId: w.shareLinkId.toString(), reason },
        });
      }
    }
    return flagged;
  }

  async voidOpens(linkId: string, actor: ActivityActor): Promise<{ voided: number }> {
    const link = await this.repo.findLink(linkId);
    if (!link) throw new NotFoundError("Share link");
    const voided = await this.repo.voidCountedOpens(link);
    await this.repo.setSuspicious(link._id, false, null);
    await this.activity.record("opens_voided", actor, {
      meta: { shareLinkId: linkId, count: voided },
    });
    return { voided };
  }

  async clearFlag(linkId: string): Promise<void> {
    const link = await this.repo.findLink(linkId);
    if (!link) throw new NotFoundError("Share link");
    if (!link.flags.suspicious) throw new AppError("Link is not flagged", 409, "NOT_FLAGGED");
    await this.repo.setSuspicious(link._id, false, null);
  }
}
