import { NotFoundError } from "../../core/errors/AppError.js";
import type { Clock } from "../../core/utils/clock.js";
import { getCampaignLifecycle } from "./campaign.domain.js";
import { toPublicOfferDto, type PublicOfferDto } from "./campaign.dto.js";
import type { CampaignRepository } from "./campaign.repository.js";

export class CampaignService {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly clock: Clock,
  ) {}

  /** Offers shown on the home page ("Share to win"). */
  async listLiveOffers(): Promise<PublicOfferDto[]> {
    const campaigns = await this.campaigns.findLiveForHome(this.clock.now());
    return campaigns.map((campaign) => toPublicOfferDto(campaign, "live"));
  }

  /**
   * A single offer for detail / share-landing pages. Live and ended campaigns
   * are visible (old shared links keep working and show "ended"); drafts and
   * not-yet-started campaigns are hidden as 404 so they can't be discovered early.
   */
  async getOffer(id: string): Promise<PublicOfferDto> {
    const campaign = await this.campaigns.findPublishedById(id);
    if (!campaign) throw new NotFoundError("Campaign");

    const lifecycle = getCampaignLifecycle(campaign, this.clock.now());
    if (lifecycle !== "live" && lifecycle !== "ended") throw new NotFoundError("Campaign");

    return toPublicOfferDto(campaign, lifecycle);
  }
}
