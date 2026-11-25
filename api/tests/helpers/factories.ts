import { CampaignModel, type Campaign } from "../../src/modules/campaign/campaign.model.js";
import { ContentModel } from "../../src/modules/content/content.model.js";
import { ParticipantModel } from "../../src/modules/participant/participant.model.js";

const DAY_MS = 24 * 60 * 60 * 1000;
let sequence = 0;

export const NOW = new Date("2026-11-23T06:00:00.000Z");
export const daysFrom = (base: Date, days: number) => new Date(base.getTime() + days * DAY_MS);

interface CampaignOverrides {
  slug?: string;
  name?: string;
  status?: Campaign["status"];
  isActive?: boolean;
  sortOrder?: number;
  showOnHome?: boolean;
  startAt?: Date;
  endAt?: Date;
  opens?: number;
}

/** A published campaign that is live at NOW unless overridden. */
export async function createCampaign(overrides: CampaignOverrides = {}) {
  sequence += 1;
  return CampaignModel.create({
    slug: overrides.slug ?? `campaign-${sequence}`,
    name: overrides.name ?? `Campaign ${sequence}`,
    merchantName: "Merchant",
    offerTitle: "Tk 200 discount",
    description: "Description",
    status: overrides.status ?? "published",
    isActive: overrides.isActive ?? true,
    sortOrder: overrides.sortOrder ?? 0,
    reward: { title: "iPhone 18 Pro", imageUrl: "https://cdn.example.com/prize.png" },
    schedule: {
      startAt: overrides.startAt ?? daysFrom(NOW, -1),
      endAt: overrides.endAt ?? daysFrom(NOW, 10),
      validityLabel: "Valid until 3 Dec",
    },
    media: { bannerUrl: "https://cdn.example.com/banner.png", logoUrl: null },
    settings: { showOnHome: overrides.showOnHome ?? true },
    stats: { participants: 0, shares: 0, opens: overrides.opens ?? 0 },
  });
}

export async function createParticipant(lastActiveAt: Date) {
  sequence += 1;
  return ParticipantModel.create({
    phone: `0171${String(sequence).padStart(7, "0")}`,
    firstLoginAt: lastActiveAt,
    lastActiveAt,
  });
}

export async function createTerms() {
  return ContentModel.create({
    key: "terms",
    current: {
      version: 3,
      title: "Terms & Conditions",
      summary: "Summary",
      sections: [{ heading: "Eligibility", body: "Open to all." }],
      savedAt: NOW,
    },
  });
}
