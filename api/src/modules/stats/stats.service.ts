import type { Clock } from "../../core/utils/clock.js";
import { startOfDhakaDay } from "../../core/utils/time.js";
import { TtlCache } from "../../core/utils/ttlCache.js";
import type { ParticipantRepository } from "../participant/participant.repository.js";

export interface PublicStatsDto {
  /** Distinct participants active since midnight (Asia/Dhaka). */
  peopleSharingToday: number;
}

const STATS_TTL_MS = 60_000;

export class StatsService {
  private readonly cache: TtlCache<PublicStatsDto>;

  constructor(
    private readonly participants: ParticipantRepository,
    private readonly clock: Clock,
  ) {
    // Hit by every home page view; a 60s-old number is fine and saves the DB.
    this.cache = new TtlCache(STATS_TTL_MS, clock);
  }

  getPublicStats(): Promise<PublicStatsDto> {
    return this.cache.get(async () => ({
      peopleSharingToday: await this.participants.countActiveSince(
        startOfDhakaDay(this.clock.now()),
      ),
    }));
  }
}
