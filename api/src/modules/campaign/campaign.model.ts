import { Schema, model, type Types } from "mongoose";

export const RANKING_BASIS = ["opens", "shares"] as const;
export const WINNER_SELECTION = ["top_sharer"] as const;
export const PUBLISH_STATUS = ["draft", "published"] as const;

export interface Campaign {
  slug: string;
  name: string;
  merchantName: string;
  offerTitle: string;
  description: string;
  reward: {
    title: string;
    /** Artwork that replaces the whole reward banner; unset → the built-in design. */
    bannerImageUrl: string | null;
    /** Prize picture for the shared-link tile and the built-in reward banner. */
    tileImageUrl: string | null;
    /** Older campaigns' prize picture: used when there is no `tileImageUrl`. */
    imageUrl: string | null;
    winnerSelection: (typeof WINNER_SELECTION)[number];
    numberOfWinners: number;
    rankingBasis: (typeof RANKING_BASIS)[number];
  };
  schedule: { startAt: Date; endAt: Date; validityLabel: string };
  media: { bannerUrl: string | null; logoUrl: string | null };
  settings: {
    requirePhone: boolean;
    requireOtp: boolean;
    showOnHome: boolean;
    countLinkOpens: boolean;
    antiAbuse: {
      maxLinksPerDevice: number;
      maxOpensPerSubnetPerHour: number;
      maxOpensPerLinkPer10Min: number;
    };
  };
  status: (typeof PUBLISH_STATUS)[number];
  isActive: boolean;
  sortOrder: number;
  stats: { participants: number; shares: number; opens: number };
  winnerAnnouncedAt: Date | null;
  /** Snapshot taken when winners are announced (immutable afterwards). */
  winners: CampaignWinner[];
  createdBy: Types.ObjectId | null;
}

export interface CampaignWinner {
  rank: number;
  participantId: Types.ObjectId;
  phone: string;
  opens: number;
  shares: number;
}

/**
 * Only draft/published is stored. Whether a published campaign is
 * scheduled, live or ended is derived from its dates (campaign.domain.ts),
 * so no cron job is needed to flip statuses and they can never be stale.
 */
const campaignSchema = new Schema<Campaign>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    merchantName: { type: String, required: true, trim: true, maxlength: 60 },
    offerTitle: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", trim: true, maxlength: 600 },

    reward: {
      title: { type: String, required: true, trim: true, maxlength: 80 },
      imageUrl: { type: String, default: null },
      bannerImageUrl: { type: String, default: null },
      tileImageUrl: { type: String, default: null },
      winnerSelection: { type: String, enum: WINNER_SELECTION, default: "top_sharer" },
      numberOfWinners: { type: Number, default: 1, min: 1, max: 100 },
      rankingBasis: { type: String, enum: RANKING_BASIS, default: "opens" },
    },

    schedule: {
      startAt: { type: Date, required: true },
      endAt: { type: Date, required: true },
      validityLabel: { type: String, default: "", trim: true, maxlength: 40 },
    },

    media: {
      bannerUrl: { type: String, default: null },
      logoUrl: { type: String, default: null },
    },

    settings: {
      requirePhone: { type: Boolean, default: true },
      requireOtp: { type: Boolean, default: false },
      showOnHome: { type: Boolean, default: true },
      countLinkOpens: { type: Boolean, default: true },
      /** Anti count-boosting caps (phase 4), editable per campaign. */
      antiAbuse: {
        maxLinksPerDevice: { type: Number, default: 3, min: 1 },
        maxOpensPerSubnetPerHour: { type: Number, default: 5, min: 1 },
        maxOpensPerLinkPer10Min: { type: Number, default: 50, min: 1 },
      },
    },

    status: { type: String, enum: PUBLISH_STATUS, default: "draft", required: true },
    /** Admin on/off switch; an inactive campaign is hidden and stops counting. */
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },

    /** Denormalised counters, incremented atomically; rebuildable from source collections. */
    stats: {
      participants: { type: Number, default: 0, min: 0 },
      shares: { type: Number, default: 0, min: 0 },
      opens: { type: Number, default: 0, min: 0 },
    },

    winnerAnnouncedAt: { type: Date, default: null },
    winners: {
      type: [
        {
          _id: false,
          rank: { type: Number, required: true },
          participantId: { type: Schema.Types.ObjectId, ref: "Participant", required: true },
          phone: { type: String, required: true },
          opens: { type: Number, required: true },
          shares: { type: Number, required: true },
        },
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

campaignSchema.index({ slug: 1 }, { unique: true });
// Public home listing: published + active + visible, filtered by date window.
campaignSchema.index({ status: 1, isActive: 1, "settings.showOnHome": 1, "schedule.endAt": 1 });

// Document-level invariant (path validators get a Query as `this` during updates,
// so cross-field rules for updates are enforced in the admin service instead).
campaignSchema.pre("validate", function () {
  if (this.schedule.endAt <= this.schedule.startAt) {
    this.invalidate("schedule.endAt", "endAt must be after startAt");
  }
});

export type CampaignRecord = Campaign & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export const CampaignModel = model<Campaign>("Campaign", campaignSchema);
