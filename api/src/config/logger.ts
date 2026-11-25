import { pino } from "pino";
import { env, isProduction } from "./env.js";

/**
 * Structured JSON logs in production (ready for any log shipper);
 * human-readable output in development.
 * Secrets and personal data are redacted at the logger level.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "offer-finder-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction || env.NODE_ENV === "test"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      }),
});

export type Logger = typeof logger;
