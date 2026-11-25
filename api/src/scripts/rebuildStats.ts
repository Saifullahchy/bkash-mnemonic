/** Recompute all denormalised counters from source data:  npm run stats:rebuild */
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { rebuildCounters } from "./lib/rebuildCounters.js";

connectDatabase(env.MONGODB_URI)
  .then(rebuildCounters)
  .then((result) => logger.info(result, "Counters rebuilt"))
  .catch((error: unknown) => {
    logger.error({ err: error }, "Counter rebuild failed");
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
