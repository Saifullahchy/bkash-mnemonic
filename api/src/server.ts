import type { Server } from "node:http";
import { createApp } from "./app.js";
import { buildContainer } from "./container.js";
import { startScheduledJobs } from "./jobs/scheduler.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env, productionConfigIssues } from "./config/env.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { logger } from "./config/logger.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  for (const warning of productionConfigIssues(env).warnings) logger.warn(warning);

  await connectDatabase(env.MONGODB_URI);
  if (env.REDIS_URL) await connectRedis(env.REDIS_URL);

  const container = buildContainer();
  const app = createApp(container);
  const stopJobs = startScheduledJobs(container);
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, storage: env.STORAGE_DRIVER },
      "API listening",
    );
  });
  // Slow-client protection, and keep-alive longer than the load balancer's idle
  // timeout (usually 60 s) so it never reuses a socket the API just closed.
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 65_000;

  registerShutdown(server, stopJobs);
}

/**
 * Graceful shutdown for deploys/scale-down: stop accepting connections, let
 * in-flight requests finish, close the DB pool, then exit. Force-exit if it hangs.
 */
function registerShutdown(server: Server, stopJobs: () => void): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    stopJobs();

    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close((error) => {
      if (error) logger.error({ err: error }, "Error while closing HTTP server");
      Promise.all([disconnectDatabase(), disconnectRedis()])
        .catch((dbError: unknown) => logger.error({ err: dbError }, "Error while closing MongoDB"))
        .finally(() => process.exit(error ? 1 : 0));
    });
    server.closeIdleConnections();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  process.exit(1);
});

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "Failed to start API");
  process.exit(1);
});
