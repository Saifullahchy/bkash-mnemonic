import { Types, type QueryFilter } from "mongoose";
import {
  CampaignModel,
  type Campaign,
  type CampaignRecord,
} from "../../campaign/campaign.model.js";
import type { CampaignFilter } from "./adminCampaign.schema.js";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mongo filter equivalent of getCampaignLifecycle() for each admin tab. */
export function lifecycleFilter(filter: CampaignFilter, now: Date): QueryFilter<Campaign> {
  switch (filter) {
    case "draft":
      return { status: "draft" };
    case "scheduled":
      return { status: "published", "schedule.startAt": { $gt: now } };
    case "live":
      return {
        status: "published",
        "schedule.startAt": { $lte: now },
        "schedule.endAt": { $gt: now },
      };
    case "ended":
      return { status: "published", "schedule.endAt": { $lte: now } };
    case "all":
      return {};
  }
}

export class AdminCampaignRepository {
  async list(options: {
    filter: CampaignFilter;
    search: string | undefined;
    active: boolean | undefined;
    page: number;
    limit: number;
    now: Date;
  }): Promise<{ items: CampaignRecord[]; total: number }> {
    const query: QueryFilter<Campaign> = lifecycleFilter(options.filter, options.now);
    if (options.active !== undefined) query.isActive = options.active;
    if (options.search) {
      const pattern = new RegExp(escapeRegex(options.search), "i");
      query.$or = [{ name: pattern }, { merchantName: pattern }, { offerTitle: pattern }];
    }
    const [items, total] = await Promise.all([
      CampaignModel.find(query)
        .sort({ createdAt: -1 })
        .skip((options.page - 1) * options.limit)
        .limit(options.limit)
        .lean<CampaignRecord[]>()
        .exec(),
      CampaignModel.countDocuments(query).exec(),
    ]);
    return { items, total };
  }

  /** Counts for the status tabs: All / Live / Scheduled / Draft / Ended. */
  async countByLifecycle(now: Date): Promise<Record<CampaignFilter, number>> {
    const filters = ["all", "live", "scheduled", "draft", "ended"] as const;
    const counts = await Promise.all(
      filters.map((f) => CampaignModel.countDocuments(lifecycleFilter(f, now)).exec()),
    );
    return Object.fromEntries(filters.map((f, i) => [f, counts[i] ?? 0])) as Record<
      CampaignFilter,
      number
    >;
  }

  findById(id: string): Promise<CampaignRecord | null> {
    return CampaignModel.findById(id).lean<CampaignRecord>().exec();
  }

  slugExists(slug: string): Promise<boolean> {
    return CampaignModel.exists({ slug }).then((found) => found !== null);
  }

  async create(data: Record<string, unknown>): Promise<CampaignRecord> {
    const doc = await CampaignModel.create(data);
    return doc.toObject<CampaignRecord>();
  }

  /** $set by dot-paths (partial nested updates), with schema validators. */
  updateFields(id: string, set: Record<string, unknown>): Promise<CampaignRecord | null> {
    return CampaignModel.findByIdAndUpdate(id, { $set: set }, { new: true, runValidators: true })
      .lean<CampaignRecord>()
      .exec();
  }

  async deleteById(id: string): Promise<void> {
    await CampaignModel.deleteOne({ _id: new Types.ObjectId(id) }).exec();
  }
}
