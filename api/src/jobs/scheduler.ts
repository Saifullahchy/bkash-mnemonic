import { logger } from "../config/logger.js";
import type { Container } from "../container.js";

const TEN_MINUTES = 10 * 60_000;
const FIVE_MINUTES = 5 * 60_000;

/**
 * In-process background jobs. Each job is idempotent, so running it on every
 * API instance is safe (a dedicated worker/queue can take over at larger scale).
 */
export function startScheduledJobs({ services }: Container): () => void {
  let running = false;

  const scanSuspiciousLinks = async () => {
    if (running) return; // never overlap runs
    running = true;
    try {
      const flagged = await services.moderation.scan();
      if (flagged > 0) logger.warn({ flagged }, "Flagged suspicious share links");
    } catch (error) {
      logger.error({ err: error }, "Suspicious-link scan failed");
    } finally {
      running = false;
    }
  };

  let reporting = false;
  const sendDueReports = async () => {
    if (reporting) return;
    reporting = true;
    try {
      if (await services.reports.runDue()) logger.info("Scheduled report sent");
    } catch (error) {
      logger.error({ err: error }, "Scheduled report run failed");
    } finally {
      reporting = false;
    }
  };

  const timers = [
    setInterval(() => void scanSuspiciousLinks(), TEN_MINUTES),
    setInterval(() => void sendDueReports(), FIVE_MINUTES),
  ];
  timers.forEach((t) => t.unref());
  return () => timers.forEach(clearInterval);
}
