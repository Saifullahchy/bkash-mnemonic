import { logger } from "../../../config/logger.js";
import { AppError, NotFoundError, ValidationError } from "../../../core/errors/AppError.js";
import type { FileStorage } from "../../../core/storage/fileStorage.js";
import type { Clock } from "../../../core/utils/clock.js";
import { randomBase62 } from "../../../core/utils/codeGenerator.js";
import { validateImage, type ImageRules } from "../../../core/utils/imageValidation.js";
import { slugify } from "../../../core/utils/slug.js";
import { validUntilLabel } from "../../../core/utils/time.js";
import type { ActivityActor, ActivityService } from "../../activity/activity.service.js";
import type { ActivityType } from "../../activity/activity.model.js";
import type { Campaign, CampaignRecord } from "../../campaign/campaign.model.js";
import {
  getPublishReadiness,
  toAdminCampaignDto,
  type AdminCampaignDto,
} from "./adminCampaign.dto.js";
import type { AdminCampaignRepository } from "./adminCampaign.repository.js";
import type {
  CampaignFilter,
  CreateCampaignInput,
  MediaKind,
  UpdateCampaignInput,
} from "./adminCampaign.schema.js";

export const MEDIA_RULES: Record<MediaKind, ImageRules & { maxBytes: number }> = {
  // Design: 343×152 card banner (ratio ≈ 2.26); allow some tolerance.
  banner: {
    label: "Offer banner",
    minWidth: 343,
    minHeight: 152,
    aspect: [2.0, 2.6],
    maxBytes: 2 * 1024 * 1024,
  },
  // Design: 50×50 merchant logo.
  logo: {
    label: "Merchant logo",
    minWidth: 50,
    minHeight: 50,
    aspect: [0.8, 1.25],
    maxBytes: 1024 * 1024,
  },
  // Design: 321×88 reward banner (ratio ≈ 3.65); the image fills it, so allow little tolerance.
  "reward-banner": {
    label: "Reward banner image",
    minWidth: 321,
    minHeight: 88,
    aspect: [3.2, 4.2],
    maxBytes: 2 * 1024 * 1024,
  },
  // Design: 51×51 slot inside the shared page's 72px prize tile.
  "prize-tile": {
    label: "Prize tile image",
    minWidth: 50,
    minHeight: 50,
    aspect: [0.4, 2.2],
    maxBytes: 1024 * 1024,
  },
};
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(MEDIA_RULES).map((r) => r.maxBytes));

/** Where each kind of uploaded image is stored on the campaign. */
const MEDIA_FIELDS: Record<MediaKind, { path: string; get: (c: Campaign) => string | null }> = {
  banner: { path: "media.bannerUrl", get: (c) => c.media.bannerUrl },
  logo: { path: "media.logoUrl", get: (c) => c.media.logoUrl },
  "reward-banner": { path: "reward.bannerImageUrl", get: (c) => c.reward.bannerImageUrl },
  "prize-tile": { path: "reward.tileImageUrl", get: (c) => c.reward.tileImageUrl },
};

export class CampaignIncompleteError extends AppError {
  constructor(missing: string[]) {
    super("Campaign is not ready to publish", 422, "CAMPAIGN_INCOMPLETE", { missing });
  }
}

export class CampaignHasParticipantsError extends AppError {
  constructor(action: string) {
    super(
      `Can't ${action} a campaign that already has participants`,
      409,
      "CAMPAIGN_HAS_PARTICIPANTS",
    );
  }
}

/** { reward: { title: "x" } } → { "reward.title": "x" } so partial nested updates don't wipe siblings. */
function toDotPaths(value: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v)) {
      Object.assign(out, toDotPaths(v as Record<string, unknown>, path));
    } else {
      out[path] = v;
    }
  }
  return out;
}

export interface CampaignListResult {
  items: AdminCampaignDto[];
  total: number;
  page: number;
  limit: number;
  counts: Record<CampaignFilter, number>;
}

export class AdminCampaignService {
  constructor(
    private readonly campaigns: AdminCampaignRepository,
    private readonly storage: FileStorage,
    private readonly clock: Clock,
    private readonly activity: ActivityService,
  ) {}

  private log(
    type: ActivityType,
    actor: ActivityActor,
    campaign: { _id: { toString(): string }; name: string },
  ) {
    return this.activity.record(type, actor, {
      campaign: { id: campaign._id.toString(), name: campaign.name },
    });
  }

  async list(options: {
    filter: CampaignFilter;
    search: string | undefined;
    active: boolean | undefined;
    page: number;
    limit: number;
  }): Promise<CampaignListResult> {
    const now = this.clock.now();
    const [{ items, total }, counts] = await Promise.all([
      this.campaigns.list({ ...options, now }),
      this.campaigns.countByLifecycle(now),
    ]);
    return {
      items: items.map((c) => toAdminCampaignDto(c, now)),
      total,
      page: options.page,
      limit: options.limit,
      counts,
    };
  }

  async get(id: string): Promise<AdminCampaignDto> {
    return toAdminCampaignDto(await this.require(id), this.clock.now());
  }

  /** New campaigns always start as drafts. */
  async create(
    input: CreateCampaignInput,
    actor: ActivityActor & { id: string },
  ): Promise<AdminCampaignDto> {
    const slug = await this.uniqueSlug(input.name);
    const created = await this.campaigns.create({
      ...input,
      slug,
      status: "draft",
      createdBy: actor.id,
      schedule: {
        ...input.schedule,
        validityLabel: input.schedule.validityLabel || validUntilLabel(input.schedule.endAt),
      },
    });
    await this.log("campaign_created", actor, created);
    return toAdminCampaignDto(created, this.clock.now());
  }

  async update(id: string, input: UpdateCampaignInput): Promise<AdminCampaignDto> {
    const current = await this.require(id);

    // Cross-field rule on the merged result (a partial update may change just one date).
    const startAt = input.schedule?.startAt ?? current.schedule.startAt;
    const endAt = input.schedule?.endAt ?? current.schedule.endAt;
    if (endAt <= startAt) {
      throw new ValidationError([
        { path: "schedule.endAt", message: "End date must be after start date" },
      ]);
    }

    const set = toDotPaths(input);
    // Keep an auto-generated "Valid until …" label in sync when the end date moves.
    const labelWasAuto = current.schedule.validityLabel === validUntilLabel(current.schedule.endAt);
    if (input.schedule?.endAt && input.schedule.validityLabel === undefined && labelWasAuto) {
      set["schedule.validityLabel"] = validUntilLabel(endAt);
    }

    const updated = await this.campaigns.updateFields(id, set);
    if (!updated) throw new NotFoundError("Campaign");
    return toAdminCampaignDto(updated, this.clock.now());
  }

  async publish(id: string, actor: ActivityActor): Promise<AdminCampaignDto> {
    const campaign = await this.require(id);
    const now = this.clock.now();
    if (campaign.status === "published") return toAdminCampaignDto(campaign, now);

    const readiness = getPublishReadiness(campaign, now);
    if (!readiness.canPublish) throw new CampaignIncompleteError(readiness.missing);
    const result = await this.setFields(id, { status: "published" });
    await this.log("campaign_published", actor, campaign);
    return result;
  }

  /** Back to draft — only while nobody has joined (links would silently stop working). */
  async unpublish(id: string, actor: ActivityActor): Promise<AdminCampaignDto> {
    const campaign = await this.require(id);
    if (campaign.stats.participants > 0) throw new CampaignHasParticipantsError("unpublish");
    const result = await this.setFields(id, { status: "draft" });
    await this.log("campaign_unpublished", actor, campaign);
    return result;
  }

  /** The "Active" switch: hides the campaign and pauses counting, without losing data. */
  async setActive(id: string, isActive: boolean, actor: ActivityActor): Promise<AdminCampaignDto> {
    const result = await this.setFields(id, { isActive });
    await this.log(isActive ? "campaign_activated" : "campaign_paused", actor, {
      _id: id,
      name: result.name,
    });
    return result;
  }

  /** Only drafts nobody has joined can be deleted; everything else is kept for audit. */
  async delete(id: string, actor: ActivityActor): Promise<void> {
    const campaign = await this.require(id);
    if (campaign.status !== "draft" || campaign.stats.participants > 0) {
      throw new AppError(
        "Only unused draft campaigns can be deleted",
        409,
        "CAMPAIGN_NOT_DELETABLE",
      );
    }
    await this.campaigns.deleteById(id);
    await this.log("campaign_deleted", actor, campaign);
    await Promise.all(
      [...Object.values(MEDIA_FIELDS).map((field) => field.get(campaign)), campaign.reward.imageUrl]
        .filter((url): url is string => Boolean(url))
        .map((url) => this.removeFile(url)),
    );
  }

  async uploadMedia(id: string, kind: MediaKind, file: Express.Multer.File | undefined) {
    if (!file) throw new ValidationError([{ path: "file", message: "Choose an image to upload" }]);
    const rules = MEDIA_RULES[kind];
    if (file.size > rules.maxBytes) {
      throw new AppError(
        `${rules.label} must be under ${rules.maxBytes / 1024 / 1024}MB`,
        413,
        "FILE_TOO_LARGE",
      );
    }
    const campaign = await this.require(id);
    const image = validateImage(file.buffer, rules);

    const key = `campaigns/${id}/${kind}-${randomBase62(12)}.${image.type}`;
    const url = await this.storage.save(key, file.buffer, image.contentType);
    const field = MEDIA_FIELDS[kind];
    const previous = field.get(campaign);

    const result = await this.setFields(id, { [field.path]: url });
    if (previous) await this.removeFile(previous);
    return result;
  }

  /** The campaign is already saved: a leftover file must not turn that into an error. */
  private async removeFile(url: string): Promise<void> {
    try {
      await this.storage.delete(url);
    } catch (error) {
      logger.warn({ err: error, url }, "Could not delete an unused image");
    }
  }

  private async setFields(id: string, set: Record<string, unknown>): Promise<AdminCampaignDto> {
    const updated = await this.campaigns.updateFields(id, set);
    if (!updated) throw new NotFoundError("Campaign");
    return toAdminCampaignDto(updated, this.clock.now());
  }

  private async require(id: string): Promise<CampaignRecord> {
    const campaign = await this.campaigns.findById(id);
    if (!campaign) throw new NotFoundError("Campaign");
    return campaign;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let n = 1; n <= 50; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      if (!(await this.campaigns.slugExists(candidate))) return candidate;
    }
    return `${base}-${randomBase62(6).toLowerCase()}`;
  }
}
