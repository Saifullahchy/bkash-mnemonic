/**
 * Moves images that were uploaded to local disk over to ImageKit and points the
 * campaigns at the new URLs. Safe to run repeatedly; local files are kept.
 *
 *   npm run images:migrate
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { createStorage } from "../core/storage/createStorage.js";
import { CampaignModel } from "../modules/campaign/campaign.model.js";

const FIELDS = [
  "media.bannerUrl",
  "media.logoUrl",
  "reward.bannerImageUrl",
  "reward.imageUrl",
  "reward.tileImageUrl",
];
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

async function migrate() {
  if (env.STORAGE_DRIVER !== "imagekit") throw new Error("Set IMAGEKIT_PRIVATE_KEY first");
  const storage = createStorage(env);
  const localBase = `${env.PUBLIC_UPLOAD_BASE_URL.replace(/\/+$/, "")}/`;
  const root = path.resolve(env.UPLOAD_DIR);
  const result = { moved: 0, failed: 0 };

  for (const campaign of await CampaignModel.find()) {
    for (const field of FIELDS) {
      const url = campaign.get(field) as string | null | undefined;
      if (!url?.startsWith(localBase)) continue;
      const key = url.slice(localBase.length);
      const file = path.resolve(root, key);
      const type = TYPES[path.extname(file)];
      try {
        if (!type || !file.startsWith(`${root}${path.sep}`))
          throw new Error(`Unexpected file ${key}`);
        const newUrl = await storage.save(key, await readFile(file), type);
        // Only if unchanged meanwhile (an admin may have replaced the image).
        await CampaignModel.updateOne(
          { _id: campaign._id, [field]: url },
          { $set: { [field]: newUrl } },
        );
        result.moved++;
        logger.info({ campaign: campaign.slug, field, url: newUrl }, "Image moved to ImageKit");
      } catch (error) {
        result.failed++;
        logger.error({ err: error, campaign: campaign.slug, field }, "Could not move image");
      }
    }
  }
  if (result.failed > 0) process.exitCode = 1;
  return result;
}

connectDatabase(env.MONGODB_URI)
  .then(migrate)
  .then((result) => logger.info(result, "Image migration finished"))
  .catch((error: unknown) => {
    logger.error({ err: error }, "Image migration failed");
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
