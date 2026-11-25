import { AppError, NotFoundError } from "../../../core/errors/AppError.js";
import type { Clock } from "../../../core/utils/clock.js";
import type { ActivityActor, ActivityService } from "../../activity/activity.service.js";
import { getCampaignLifecycle, type CampaignLifecycle } from "../../campaign/campaign.domain.js";
import type { CampaignRecord } from "../../campaign/campaign.model.js";
import type { ShareLinkRecord } from "../../shareLink/shareLink.model.js";
import type { AdminCampaignRepository } from "../campaigns/adminCampaign.repository.js";
import type { LeaderboardRepository } from "./leaderboard.repository.js";

export interface LeaderboardRow {
  rank: number;
  shareLinkId: string;
  participantId: string;
  phone: string;
  shares: number;
  opens: number;
  /** Friends reached per share click (quality of sharing). */
  opensPerShare: number;
  lastSharedAt: string | null;
  lastOpenedAt: string | null;
  suspicious: boolean;
  suspiciousReason: string | null;
}

export interface LeaderboardDto {
  campaign: {
    id: string;
    name: string;
    merchantName: string;
    rewardTitle: string;
    numberOfWinners: number;
    rankingBasis: "opens" | "shares";
    endAt: string;
    lifecycle: CampaignLifecycle;
    stats: CampaignRecord["stats"];
    winnerAnnouncedAt: string | null;
    winners: {
      rank: number;
      participantId: string;
      phone: string;
      opens: number;
      shares: number;
    }[];
  };
  items: LeaderboardRow[];
  total: number;
  page: number;
  limit: number;
}

export class WinnersFlaggedError extends AppError {
  constructor(flagged: LeaderboardRow[]) {
    super(
      "Some winners have suspicious activity. Review them, or confirm to announce anyway.",
      409,
      "WINNERS_FLAGGED",
      {
        flagged: flagged.map((r) => ({ rank: r.rank, phone: r.phone, reason: r.suspiciousReason })),
      },
    );
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export class LeaderboardService {
  constructor(
    private readonly repo: LeaderboardRepository,
    private readonly campaigns: AdminCampaignRepository,
    private readonly activity: ActivityService,
    private readonly clock: Clock,
  ) {}

  async get(
    campaignId: string,
    options: { page: number; limit: number; search?: string },
  ): Promise<LeaderboardDto> {
    const campaign = await this.require(campaignId);
    const basis = campaign.reward.rankingBasis;
    const digits = options.search?.replace(/\D/g, "") ?? "";

    let links: ShareLinkRecord[];
    let ranks: number[];
    let total: number;
    if (digits) {
      links = await this.repo.searchByPhone(campaignId, digits, options.limit);
      ranks = await Promise.all(links.map((l) => this.repo.rankOf(l, basis)));
      total = links.length;
    } else {
      const skip = (options.page - 1) * options.limit;
      [links, total] = await Promise.all([
        this.repo.page(campaignId, basis, skip, options.limit),
        this.repo.countRanked(campaignId),
      ]);
      ranks = links.map((_, i) => skip + i + 1);
    }

    const phones = await this.repo.phonesFor(links.map((l) => l.participantId));
    const items = links
      .map((link, i) => this.toRow(link, ranks[i] ?? 0, phones))
      .sort((a, b) => a.rank - b.rank);

    return {
      campaign: this.campaignSummary(campaign),
      items,
      total,
      page: digits ? 1 : options.page,
      limit: options.limit,
    };
  }

  /**
   * Freezes the result: the top N (non-disqualified) participants become the
   * winners, once, after the campaign has ended. Flagged winners need `force`.
   */
  async announceWinners(
    campaignId: string,
    force: boolean,
    actor: ActivityActor,
  ): Promise<LeaderboardDto["campaign"]> {
    const campaign = await this.require(campaignId);
    const now = this.clock.now();
    if (getCampaignLifecycle(campaign, now) !== "ended") {
      throw new AppError(
        "Winners can be announced after the campaign ends",
        409,
        "CAMPAIGN_NOT_ENDED",
      );
    }
    if (campaign.winnerAnnouncedAt)
      throw new AppError("Winners were already announced", 409, "ALREADY_ANNOUNCED");

    const top = await this.repo.page(
      campaignId,
      campaign.reward.rankingBasis,
      0,
      campaign.reward.numberOfWinners,
    );
    const eligible = top.filter((l) => l[campaign.reward.rankingBasis] > 0);
    if (eligible.length === 0)
      throw new AppError("Nobody has scored in this campaign yet", 409, "NO_WINNERS");

    const phones = await this.repo.phonesFor(eligible.map((l) => l.participantId));
    const rows = eligible.map((link, i) => this.toRow(link, i + 1, phones));
    const flagged = rows.filter((r) => r.suspicious);
    if (flagged.length > 0 && !force) throw new WinnersFlaggedError(flagged);

    const winners = rows.map((r, i) => ({
      rank: r.rank,
      participantId: eligible[i]!.participantId,
      phone: r.phone,
      opens: r.opens,
      shares: r.shares,
    }));
    const saved = await this.repo.saveWinners(campaignId, winners, now);
    if (!saved) throw new AppError("Winners were already announced", 409, "ALREADY_ANNOUNCED");

    await this.activity.record("winners_announced", actor, {
      campaign: { id: campaignId, name: campaign.name },
      meta: { winners: rows.map((r) => r.phone) },
    });
    return this.campaignSummary(await this.require(campaignId));
  }

  private toRow(link: ShareLinkRecord, rank: number, phones: Map<string, string>): LeaderboardRow {
    return {
      rank,
      shareLinkId: link._id.toString(),
      participantId: link.participantId.toString(),
      phone: phones.get(link.participantId.toString()) ?? "",
      shares: link.shares,
      opens: link.opens,
      opensPerShare: link.shares ? round1(link.opens / link.shares) : link.opens,
      lastSharedAt: link.lastSharedAt?.toISOString() ?? null,
      lastOpenedAt: link.lastOpenedAt?.toISOString() ?? null,
      suspicious: link.flags.suspicious,
      suspiciousReason: link.flags.suspiciousReason ?? null,
    };
  }

  private campaignSummary(c: CampaignRecord): LeaderboardDto["campaign"] {
    return {
      id: c._id.toString(),
      name: c.name,
      merchantName: c.merchantName,
      rewardTitle: c.reward.title,
      numberOfWinners: c.reward.numberOfWinners,
      rankingBasis: c.reward.rankingBasis,
      endAt: c.schedule.endAt.toISOString(),
      lifecycle: getCampaignLifecycle(c, this.clock.now()),
      stats: c.stats,
      winnerAnnouncedAt: c.winnerAnnouncedAt?.toISOString() ?? null,
      winners: (c.winners ?? []).map((w) => ({
        rank: w.rank,
        participantId: w.participantId.toString(),
        phone: w.phone,
        opens: w.opens,
        shares: w.shares,
      })),
    };
  }

  private async require(id: string): Promise<CampaignRecord> {
    const campaign = await this.campaigns.findById(id);
    if (!campaign || campaign.status !== "published") throw new NotFoundError("Campaign");
    return campaign;
  }
}
