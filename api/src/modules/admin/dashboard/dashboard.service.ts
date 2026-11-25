import type { Clock } from "../../../core/utils/clock.js";
import { DAY_MS, percentChange } from "../../../core/utils/stats.js";
import { dhakaDateKey, startOfDhakaDay } from "../../../core/utils/time.js";
import type { ActivityDto, ActivityService } from "../../activity/activity.service.js";
import type { AdminCampaignRepository } from "../campaigns/adminCampaign.repository.js";
import type { DashboardRepository } from "./dashboard.repository.js";

export type KpiRange = "7d" | "30d";
export type ChartRange = "7d" | "30d" | "all";

const RANGE_DAYS: Record<KpiRange, number> = { "7d": 7, "30d": 30 };
const MAX_CHART_DAYS = 90;

export interface Kpi {
  value: number;
  /** % change of new activity in the selected period vs the period before. */
  changePct: number;
}

export interface DashboardDto {
  range: KpiRange;
  kpis: {
    liveCampaigns: { value: number; total: number };
    participants: Kpi;
    shares: Kpi;
    opens: Kpi;
  };
  chart: {
    range: ChartRange;
    days: string[];
    series: { campaignId: string; label: string; values: number[] }[];
  };
  liveCampaigns: {
    id: string;
    name: string;
    merchantName: string;
    endAt: string;
    participants: number;
    shares: number;
    sharePct: number;
  }[];
  counts: { scheduled: number; draft: number; ended: number };
  topSharers: {
    rank: number;
    participantId: string;
    phone: string;
    campaignId: string;
    campaignName: string;
    shares: number;
    opens: number;
  }[];
  activity: ActivityDto[];
}

export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly campaigns: AdminCampaignRepository,
    private readonly activity: ActivityService,
    private readonly clock: Clock,
  ) {}

  async get(range: KpiRange, chartRange: ChartRange): Promise<DashboardDto> {
    const now = this.clock.now();
    const span = RANGE_DAYS[range] * DAY_MS;
    const current = new Date(now.getTime() - span);
    const previous = new Date(now.getTime() - 2 * span);
    const end = new Date(now.getTime() + 1); // windows include "now"

    const [
      totalParticipants,
      newParticipants,
      prevParticipants,
      newShares,
      prevShares,
      newOpens,
      prevOpens,
      totals,
      live,
      lifecycleCounts,
      activity,
    ] = await Promise.all([
      this.repo.countParticipants(),
      this.repo.countNewParticipants(current, end),
      this.repo.countNewParticipants(previous, current),
      this.repo.countShareEvents(current, end),
      this.repo.countShareEvents(previous, current),
      this.repo.countCountedOpens(current, end),
      this.repo.countCountedOpens(previous, current),
      this.repo.campaignTotals(),
      this.repo.liveCampaigns(now),
      this.campaigns.countByLifecycle(now),
      this.activity.recent(6),
    ]);

    const liveIds = live.map((c) => c._id);
    const liveShareTotal = live.reduce((sum, c) => sum + c.stats.shares, 0);
    const names = new Map(live.map((c) => [c._id.toString(), c]));

    // Chart: one value per Dhaka day per live campaign (missing days = 0).
    const earliest = live.reduce(
      (min, c) => Math.min(min, c.schedule.startAt.getTime()),
      now.getTime(),
    );
    const chartDays =
      chartRange === "all"
        ? Math.min(MAX_CHART_DAYS, Math.max(1, Math.ceil((now.getTime() - earliest) / DAY_MS) + 1))
        : RANGE_DAYS[chartRange];
    const firstDay = startOfDhakaDay(new Date(now.getTime() - (chartDays - 1) * DAY_MS));
    const days = Array.from({ length: chartDays }, (_, i) =>
      dhakaDateKey(new Date(firstDay.getTime() + i * DAY_MS + 12 * 3600_000)),
    );
    const daily = liveIds.length ? await this.repo.dailyShares(liveIds, firstDay) : [];
    const byKey = new Map(daily.map((d) => [`${d.campaignId}|${d.day}`, d.count]));

    const top = liveIds.length ? await this.repo.topLinks(liveIds, 5) : [];
    const phones = await this.repo.phonesFor(top.map((l) => l.participantId));

    return {
      range,
      kpis: {
        liveCampaigns: { value: live.length, total: lifecycleCounts.all },
        participants: {
          value: totalParticipants,
          changePct: percentChange(newParticipants, prevParticipants),
        },
        shares: { value: totals.shares, changePct: percentChange(newShares, prevShares) },
        opens: { value: totals.opens, changePct: percentChange(newOpens, prevOpens) },
      },
      chart: {
        range: chartRange,
        days,
        series: live.map((c) => ({
          campaignId: c._id.toString(),
          label: `${c.merchantName} offer`,
          values: days.map((day) => byKey.get(`${c._id.toString()}|${day}`) ?? 0),
        })),
      },
      liveCampaigns: live.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        merchantName: c.merchantName,
        endAt: c.schedule.endAt.toISOString(),
        participants: c.stats.participants,
        shares: c.stats.shares,
        sharePct: liveShareTotal ? Math.round((c.stats.shares / liveShareTotal) * 100) : 0,
      })),
      counts: {
        scheduled: lifecycleCounts.scheduled,
        draft: lifecycleCounts.draft,
        ended: lifecycleCounts.ended,
      },
      topSharers: top.map((link, i) => ({
        rank: i + 1,
        participantId: link.participantId.toString(),
        phone: phones.get(link.participantId.toString()) ?? "",
        campaignId: link.campaignId.toString(),
        campaignName: names.get(link.campaignId.toString())?.merchantName ?? "",
        shares: link.shares,
        opens: link.opens,
      })),
      activity,
    };
  }
}
