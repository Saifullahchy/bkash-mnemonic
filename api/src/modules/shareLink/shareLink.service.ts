import { AppError, NotFoundError } from "../../core/errors/AppError.js";
import type { Clock } from "../../core/utils/clock.js";
import { randomBase62, SHARE_CODE_LENGTH } from "../../core/utils/codeGenerator.js";
import { getCampaignLifecycle } from "../campaign/campaign.domain.js";
import type { CampaignRecord } from "../campaign/campaign.model.js";
import type { CampaignRepository } from "../campaign/campaign.repository.js";
import type { ParticipantRepository } from "../participant/participant.repository.js";
import {
  shareUrl,
  toShareLinkDto,
  type ActivityItemDto,
  type ShareLinkDto,
} from "./shareLink.dto.js";
import type { ShareLinkRecord } from "./shareLink.model.js";
import type { ShareLinkRepository } from "./shareLink.repository.js";

/** A share counts at most once per link per minute (double clicks, retries). */
export const SHARE_DEDUP_WINDOW_MS = 60_000;
const MAX_CODE_ATTEMPTS = 5;

export class CampaignNotLiveError extends AppError {
  constructor() {
    super("This campaign is not running right now", 409, "CAMPAIGN_NOT_LIVE");
  }
}

function duplicateKeyField(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
    return null;
  }
  const keyPattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
  return "code" in keyPattern ? "code" : "participant_campaign";
}

export class ShareLinkService {
  constructor(
    private readonly links: ShareLinkRepository,
    private readonly campaigns: CampaignRepository,
    private readonly participants: ParticipantRepository,
    private readonly clock: Clock,
    private readonly siteUrl: string,
  ) {}

  /**
   * Idempotent: returns the participant's existing link for the campaign or
   * creates one. Safe under concurrent requests thanks to the unique
   * (campaignId, participantId) index; code collisions are retried.
   */
  async getOrCreate(
    participantId: string,
    campaignId: string,
  ): Promise<{ link: ShareLinkDto; created: boolean }> {
    await this.requireLiveCampaign(campaignId);

    const existing = await this.links.findForParticipant(participantId, campaignId);
    if (existing) return { link: toShareLinkDto(existing, this.siteUrl), created: false };

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        const link = await this.links.create({
          participantId,
          campaignId,
          code: randomBase62(SHARE_CODE_LENGTH),
        });
        await Promise.all([
          this.campaigns.incrementStat(campaignId, "participants"),
          this.participants.addCampaign(participantId, campaignId),
          this.participants.touch(participantId, this.clock.now()),
        ]);
        return { link: toShareLinkDto(link, this.siteUrl), created: true };
      } catch (error) {
        const field = duplicateKeyField(error);
        if (field === "code") continue; // astronomically rare; try a new code
        if (field === "participant_campaign") {
          // A parallel request created it first — return that one.
          const raced = await this.links.findForParticipant(participantId, campaignId);
          if (raced) return { link: toShareLinkDto(raced, this.siteUrl), created: false };
        }
        throw error;
      }
    }
    throw new Error("Could not generate a unique share code");
  }

  /** Records a Share/Copy click on the participant's own link. */
  async recordShare(participantId: string, campaignId: string): Promise<{ counted: boolean }> {
    await this.requireLiveCampaign(campaignId);
    const link = await this.links.findForParticipant(participantId, campaignId);
    if (!link) throw new NotFoundError("Share link");

    const now = this.clock.now();
    const counted = await this.links.recordShare(link._id, now, SHARE_DEDUP_WINDOW_MS);
    if (counted) {
      await Promise.all([
        this.campaigns.incrementStat(campaignId, "shares"),
        this.participants.incrementStats(participantId, { shares: 1 }),
        this.participants.touch(participantId, now),
        this.links.insertShareEvent(link, now),
      ]);
    }
    return { counted };
  }

  /** "Your Sharing Activity": progress on every live campaign shown on the home page. */
  async getActivity(participantId: string): Promise<ActivityItemDto[]> {
    const campaigns = await this.campaigns.findLiveForHome(this.clock.now());
    if (campaigns.length === 0) return [];

    const links = await this.links.findManyForParticipant(
      participantId,
      campaigns.map((c) => c._id.toString()),
    );
    const byCampaign = new Map<string, ShareLinkRecord>(
      links.map((link) => [link.campaignId.toString(), link]),
    );

    return campaigns.map((campaign) => {
      const link = byCampaign.get(campaign._id.toString());
      return {
        campaignId: campaign._id.toString(),
        label: `${campaign.merchantName} offer`,
        opens: link?.opens ?? 0,
        shares: link?.shares ?? 0,
        link: link ? { code: link.code, url: shareUrl(this.siteUrl, link.code) } : null,
      };
    });
  }

  private async requireLiveCampaign(campaignId: string): Promise<CampaignRecord> {
    const campaign = await this.campaigns.findPublishedById(campaignId);
    if (!campaign) throw new NotFoundError("Campaign");
    if (getCampaignLifecycle(campaign, this.clock.now()) !== "live")
      throw new CampaignNotLiveError();
    return campaign;
  }
}
