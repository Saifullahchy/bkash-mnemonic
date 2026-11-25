import { NotFoundError } from "../../core/errors/AppError.js";
import type { OpenTokens } from "../../core/security/openTokens.js";
import type { Clock } from "../../core/utils/clock.js";
import { getCampaignLifecycle } from "../campaign/campaign.domain.js";
import { toPublicOfferDto, type PublicOfferDto } from "../campaign/campaign.dto.js";
import type { CampaignRepository } from "../campaign/campaign.repository.js";
import type { ParticipantRepository } from "../participant/participant.repository.js";
import type { ShareLinkRepository } from "../shareLink/shareLink.repository.js";
import type { OpenReason } from "./linkOpen.model.js";
import type { AntiAbuseService, OpenContext } from "./policies.js";
import type { TrackingRepository } from "./tracking.repository.js";

export interface ShareLandingDto {
  code: string;
  offer: PublicOfferDto;
  /** Single-use proof of a page view; null when the campaign is not counting. */
  openToken: string | null;
}

export interface RecordOpenInput {
  code: string;
  token: string;
  honeypot: string | undefined;
  visitorId: string;
  deviceHash: string;
  subnetHash: string;
  sessionParticipantId: string | undefined;
}

export interface RecordOpenResult {
  counted: boolean;
  /** For logs/tests only — never sent to clients (no feedback for abusers). */
  reason: OpenReason;
}

export class TrackingService {
  constructor(
    private readonly links: ShareLinkRepository,
    private readonly campaigns: CampaignRepository,
    private readonly participants: ParticipantRepository,
    private readonly tracking: TrackingRepository,
    private readonly antiAbuse: AntiAbuseService,
    private readonly tokens: OpenTokens,
    private readonly clock: Clock,
  ) {}

  /** Data for offer-finder.com/s/{code}. Never exposes who shared the link. */
  async getLanding(code: string): Promise<ShareLandingDto> {
    const link = await this.links.findByCode(code);
    if (!link) throw new NotFoundError("Share link");

    const campaign = await this.campaigns.findPublishedById(link.campaignId.toString());
    if (!campaign) throw new NotFoundError("Share link");

    const now = this.clock.now();
    const lifecycle = getCampaignLifecycle(campaign, now);
    if (lifecycle !== "live" && lifecycle !== "ended") throw new NotFoundError("Share link");

    return {
      code,
      offer: toPublicOfferDto(campaign, lifecycle),
      openToken:
        lifecycle === "live" && campaign.settings.countLinkOpens
          ? this.tokens.issue(code, now)
          : null,
    };
  }

  /**
   * Counts a friend's open at most once, after every anti-abuse policy passes.
   * Every attempt is recorded with its reason (audit trail for admins); counted
   * opens bump the link and campaign counters atomically.
   */
  async recordOpen(input: RecordOpenInput): Promise<RecordOpenResult> {
    const link = await this.links.findByCode(input.code);
    if (!link) throw new NotFoundError("Share link");

    const [campaign, owner] = await Promise.all([
      this.campaigns.findPublishedById(link.campaignId.toString()),
      this.participants.findById(link.participantId.toString()),
    ]);
    const now = this.clock.now();

    const ctx: OpenContext = {
      link,
      campaign,
      owner,
      token: input.token,
      honeypot: input.honeypot,
      visitorId: input.visitorId,
      deviceHash: input.deviceHash,
      subnetHash: input.subnetHash,
      sessionParticipantId: input.sessionParticipantId,
      now,
    };

    let reason = await this.antiAbuse.evaluate(ctx);
    const record = {
      shareLinkId: link._id,
      campaignId: link.campaignId,
      ownerId: link.participantId,
      visitorId: input.visitorId,
      deviceHash: input.deviceHash,
      subnetHash: input.subnetHash,
    };

    if (reason === "counted") {
      const outcome = await this.tracking.insertOpen({ ...record, counted: true, reason }, now);
      if (outcome === "inserted") {
        await Promise.all([
          this.links.incrementOpens(link._id, now),
          this.campaigns.incrementStat(link.campaignId.toString(), "opens"),
          this.participants.incrementStats(link.participantId, { opens: 1 }),
        ]);
        return { counted: true, reason };
      }
      reason = "duplicate"; // lost a race against a concurrent open from the same browser/device
    }

    await this.tracking.insertOpen({ ...record, counted: false, reason }, now);
    return { counted: false, reason };
  }
}
