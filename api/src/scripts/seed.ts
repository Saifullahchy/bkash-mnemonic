/**
 * Idempotent demo data for local development: campaigns in every lifecycle
 * state plus the Terms & Conditions content. Safe to run repeatedly — records
 * are upserted by slug/key and counters are only set on first insert.
 *
 *   npm run seed
 */
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env, isProduction } from "../config/env.js";
import { logger } from "../config/logger.js";
import { CampaignModel, type Campaign } from "../modules/campaign/campaign.model.js";
import { validUntilLabel } from "../core/utils/time.js";
import { hashPassword } from "../core/security/passwords.js";
import { sectionsToHtml } from "../core/security/htmlSanitizer.js";
import { AdminModel } from "../modules/admin/admin.model.js";
import { ContentModel } from "../modules/content/content.model.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysFromNow = (days: number) => new Date(now + days * DAY_MS);
const asset = (path: string) => new URL(path, env.SEED_ASSET_BASE_URL).toString();

const validUntil = validUntilLabel;

type SeedCampaign = Pick<
  Campaign,
  "slug" | "name" | "merchantName" | "offerTitle" | "description" | "status"
> & {
  startAt: Date;
  endAt: Date;
  reward: { title: string; imageUrl: string | null };
  bannerUrl: string | null;
  sortOrder: number;
  initialOpens: number;
  initialShares: number;
};

const campaigns: SeedCampaign[] = [
  {
    slug: "foodi-food-fair",
    name: "Foodi Food Fair",
    merchantName: "Foodi",
    offerTitle: "Tk 200 discount on food orders",
    description:
      "Get BDT 100 discount on a BDT 399 order at Foodi Food Fest with bKash Payment, up to BDT 200 twice during the campaign.",
    status: "published",
    startAt: daysFromNow(-14),
    endAt: daysFromNow(21),
    reward: { title: "iPhone 18 Pro", imageUrl: asset("/mock/prize-iphone.svg") },
    bannerUrl: asset("/mock/foodi-banner.png"),
    sortOrder: 1,
    initialOpens: 78540,
    initialShares: 241300,
  },
  {
    slug: "superstore-amazing-deals",
    name: "Amazing Deals at Superstore",
    merchantName: "Superstore",
    offerTitle: "Get Discount with D2 Code",
    description:
      "Use promo code D2 at checkout to get up to BDT 200 discount on superstore purchases paid with bKash.",
    status: "published",
    startAt: daysFromNow(-7),
    endAt: daysFromNow(35),
    reward: { title: "Coke 250ml", imageUrl: asset("/mock/prize-coke.png") },
    bannerUrl: asset("/mock/superstore-banner.png"),
    sortOrder: 2,
    initialOpens: 47878,
    initialShares: 143620,
  },
  {
    slug: "daraz-11-11-mega-sale",
    name: "Daraz 11.11 Mega Sale",
    merchantName: "Daraz",
    offerTitle: "11.11 Mega Sale Cashback",
    description: "Cashback on Daraz orders paid with bKash during the 11.11 sale.",
    status: "published",
    startAt: daysFromNow(3),
    endAt: daysFromNow(14),
    reward: { title: "55-inch Smart TV", imageUrl: null },
    bannerUrl: null,
    sortOrder: 3,
    initialOpens: 0,
    initialShares: 0,
  },
  {
    slug: "pickaboo-gadget-fest",
    name: "Pickaboo Gadget Fest",
    merchantName: "Pickaboo",
    offerTitle: "Gadget Fest Cashback",
    description: "Cashback on gadgets at Pickaboo.",
    status: "draft",
    startAt: daysFromNow(10),
    endAt: daysFromNow(30),
    reward: { title: "AirPods Pro", imageUrl: null },
    bannerUrl: null,
    sortOrder: 4,
    initialOpens: 0,
    initialShares: 0,
  },
  {
    slug: "chaldal-grocery-bonanza",
    name: "Chaldal Grocery Bonanza",
    merchantName: "Chaldal",
    offerTitle: "Grocery Bonanza Offer",
    description: "Discounts on groceries at Chaldal with bKash.",
    status: "published",
    startAt: daysFromNow(-60),
    endAt: daysFromNow(-30),
    reward: { title: "BDT 50,000", imageUrl: null },
    bannerUrl: null,
    sortOrder: 5,
    initialOpens: 31206,
    initialShares: 98420,
  },
];

const terms = {
  title: "Terms & Conditions",
  summary:
    "Rewards are subject to eligibility, campaign validity and merchant availability. One verified mobile number per participant.",
  sections: [
    {
      heading: "Eligibility",
      body: "This campaign is open to bKash users with a valid Bangladeshi mobile number. One verified mobile number is allowed per participant.",
    },
    {
      heading: "How it works",
      body: "Participants verify their phone number, receive a personal share link and share it with friends. Each time a friend opens the link, it counts toward the participant's ranking.",
    },
    {
      heading: "Rewards",
      body: "The participant with the most link shares when the campaign ends wins the reward shown on the offer card. Rewards are non-transferable and cannot be exchanged for cash.",
    },
    {
      heading: "Fair use",
      body: "Fake, automated or duplicate activity may lead to disqualification. bKash reserves the right to amend or end any campaign at any time.",
    },
  ],
};

async function seed(): Promise<void> {
  if (isProduction && !process.argv.includes("--force")) {
    throw new Error("Refusing to seed demo data in production (pass --force to override).");
  }

  await connectDatabase(env.MONGODB_URI);
  await mongoose.connection.syncIndexes();

  for (const c of campaigns) {
    await CampaignModel.findOneAndUpdate(
      { slug: c.slug },
      {
        $set: {
          name: c.name,
          merchantName: c.merchantName,
          offerTitle: c.offerTitle,
          description: c.description,
          status: c.status,
          isActive: true,
          sortOrder: c.sortOrder,
          "reward.title": c.reward.title,
          "reward.imageUrl": c.reward.imageUrl,
          "schedule.startAt": c.startAt,
          "schedule.endAt": c.endAt,
          "schedule.validityLabel": validUntil(c.endAt),
          "media.bannerUrl": c.bannerUrl,
        },
        $setOnInsert: {
          "stats.opens": c.initialOpens,
          "stats.shares": c.initialShares,
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    logger.info({ slug: c.slug }, "Seeded campaign");
  }

  await ContentModel.updateOne(
    { key: "terms" },
    {
      $setOnInsert: {
        key: "terms",
        current: {
          title: terms.title,
          summary: terms.summary,
          html: sectionsToHtml(terms.sections),
          sections: [],
          version: 1,
          savedAt: new Date(),
        },
        history: [],
      },
    },
    { upsert: true },
  );
  logger.info("Seeded Terms & Conditions");

  // Local admin account (credentials come from .env, never from code).
  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
    const exists = await AdminModel.exists({ email: env.SEED_ADMIN_EMAIL.toLowerCase() });
    if (!exists) {
      await AdminModel.create({
        name: "Admin User",
        email: env.SEED_ADMIN_EMAIL,
        passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
        role: "admin",
      });
    }
    logger.info(
      { email: env.SEED_ADMIN_EMAIL },
      "Seeded admin (password from SEED_ADMIN_PASSWORD)",
    );
  }
}

seed()
  .then(() => logger.info("Seed complete"))
  .catch((error: unknown) => {
    logger.error({ err: error }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
