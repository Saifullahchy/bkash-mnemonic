/**
 * Creates the indexes declared in the Mongoose schemas. Production boots with
 * autoIndex off (building indexes on boot can lock big collections), so run this
 * as a deploy step:   npm run db:indexes            (create missing, report extras)
 *                     npm run db:indexes -- --drop  (also drop indexes no schema declares)
 */
import type { Model } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ActivityModel } from "../modules/activity/activity.model.js";
import { AdminModel } from "../modules/admin/admin.model.js";
import { ExportLogModel } from "../modules/admin/exports/exportLog.model.js";
import { ReportScheduleModel } from "../modules/admin/exports/reportSchedule.model.js";
import { CampaignModel } from "../modules/campaign/campaign.model.js";
import { ContentModel } from "../modules/content/content.model.js";
import { ParticipantModel } from "../modules/participant/participant.model.js";
import { ShareEventModel } from "../modules/shareLink/shareEvent.model.js";
import { ShareLinkModel } from "../modules/shareLink/shareLink.model.js";
import { LinkOpenModel } from "../modules/tracking/linkOpen.model.js";
import { UsedOpenTokenModel } from "../modules/tracking/usedOpenToken.model.js";

const MODELS: Model<never>[] = [
  ActivityModel,
  AdminModel,
  ExportLogModel,
  ReportScheduleModel,
  CampaignModel,
  ContentModel,
  ParticipantModel,
  ShareEventModel,
  ShareLinkModel,
  LinkOpenModel,
  UsedOpenTokenModel,
] as unknown as Model<never>[];

async function syncIndexes(drop: boolean): Promise<void> {
  for (const model of MODELS) {
    const name = model.collection.collectionName;
    await model.createCollection().catch(() => undefined); // already exists
    const diff = await model.diffIndexes();
    if (diff.toCreate.length) {
      await model.createIndexes();
      logger.info({ collection: name, created: diff.toCreate }, "Indexes created");
    }
    if (diff.toDrop.length) {
      if (drop) {
        for (const index of diff.toDrop as string[]) await model.collection.dropIndex(index);
        logger.warn({ collection: name, dropped: diff.toDrop }, "Indexes dropped");
      } else {
        logger.warn(
          { collection: name, extra: diff.toDrop },
          "Extra indexes (re-run with --drop to remove)",
        );
      }
    }
    if (!diff.toCreate.length && !diff.toDrop.length)
      logger.info({ collection: name }, "Indexes up to date");
  }
}

connectDatabase(env.MONGODB_URI)
  .then(() => syncIndexes(process.argv.includes("--drop")))
  .catch((error: unknown) => {
    logger.error({ err: error }, "Index sync failed");
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
