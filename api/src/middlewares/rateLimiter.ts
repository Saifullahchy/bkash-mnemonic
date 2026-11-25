import { rateLimit, type Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { RedisClientType } from "redis";
import type { Request, RequestHandler } from "express";
import { logger } from "../config/logger.js";
import { TooManyRequestsError } from "../core/errors/AppError.js";
import type { RateLimitStoreFactory } from "../routes/routerConfig.js";

export interface RateLimiterOptions {
  /** Distinguishes limiter buckets in logs and keys, e.g. "global", "auth-phone". */
  name: string;
  windowMs: number;
  limit: number;
  enabled?: boolean;
  /** Custom bucket key (per phone, participant, visitor…). Defaults to client IP. */
  keyGenerator?: (req: Request) => string;
  /** Requests for which this limiter does not apply. */
  skip?: (req: Request) => boolean;
  /**
   * Custom response when the limit is hit (default: 429 envelope). Used by
   * tracking endpoints to fail silently, so abusers get no signal to tune against.
   */
  onLimited?: RequestHandler;
  /** Only count failed requests (status >= 400), e.g. login attempts. */
  skipSuccessfulRequests?: boolean;
  /** Shared store (Redis) for multi-instance deployments; default in-memory. */
  store?: RateLimitStoreFactory;
}

/** Routes express-rate-limit's own diagnostics (e.g. store errors) to pino. */
const rateLimitLogger = (limiter: string) => ({
  error: (err: unknown, msg?: string) =>
    logger.warn({ err, limiter }, msg ?? "Rate-limit store error"),
  warn: (msg: unknown) => logger.warn({ limiter }, String(msg)),
  info: (msg: unknown) => logger.info({ limiter }, String(msg)),
  debug: (msg: unknown) => logger.debug({ limiter }, String(msg)),
});

const passThrough: RequestHandler = (_req, _res, next) => next();

/**
 * Factory for all rate limiters in the API, so every limiter shares the same
 * headers, error envelope and store (Redis when configured, so limits hold
 * across API instances). Exceeding a limit raises TooManyRequestsError -> 429.
 * If the store is unreachable the limiter fails open (logged): availability
 * wins, and the DB-backed counting rules still block count-boosting.
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  if (options.enabled === false) return passThrough;

  const config: Partial<Options> = {
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    identifier: options.name,
    handler: options.onLimited ?? ((_req, _res, next) => next(new TooManyRequestsError())),
  };
  if (options.keyGenerator) {
    const keyGenerator = options.keyGenerator;
    config.keyGenerator = (req) => `${options.name}:${keyGenerator(req)}`;
  }
  if (options.store) {
    config.store = options.store(options.name);
    config.passOnStoreError = true;
    config.logger = rateLimitLogger(options.name);
  }
  if (options.skip) config.skip = options.skip;
  if (options.skipSuccessfulRequests) config.skipSuccessfulRequests = true;

  return rateLimit(config);
}

/** One Redis-backed store per limiter, namespaced as `rl:<limiter>:<key>`. */
export function redisRateLimitStore(client: RedisClientType): RateLimitStoreFactory {
  return (name) =>
    new RedisStore({
      prefix: `rl:${name}:`,
      sendCommand: (...args: string[]) => client.sendCommand(args),
    });
}
