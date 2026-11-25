import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const envFields = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "must be a mongodb:// connection string"),

  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url())),

  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  /**
   * Shared with the web and admin servers: requests carrying it are ours, so the visitor IP
   * they pass along (X-Client-IP) is trusted. Empty = nobody is trusted.
   */
  PROXY_SECRET: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.string().min(32, "PROXY_SECRET must be at least 32 characters").optional()),

  RATE_LIMIT_ENABLED: booleanString,
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  SEED_ASSET_BASE_URL: z.url().default("http://localhost:3000"),

  /** Public offer site origin; share links are built as `${PUBLIC_SITE_URL}/s/{code}`. */
  PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),

  /** HMAC secret for participant session JWTs. Rotate to log everyone out. */
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** e.g. ".offer-finder.com" so the cookie is shared by the site and api subdomains. Empty = host-only. */
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  /** Signs the single-use open token embedded in the share landing page. */
  OPEN_TOKEN_SECRET: z.string().min(32, "OPEN_TOKEN_SECRET must be at least 32 characters"),
  /** Salt for device/subnet hashes; raw IP addresses are never stored. */
  FINGERPRINT_SALT: z.string().min(16, "FINGERPRINT_SALT must be at least 16 characters"),
  /** Admin panel sessions: separate secret so a leaked participant secret can't mint admin tokens. */
  ADMIN_SESSION_SECRET: z.string().min(32, "ADMIN_SESSION_SECRET must be at least 32 characters"),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(72).default(8),
  /** "Keep me signed in" on the admin login. */
  ADMIN_REMEMBER_DAYS: z.coerce.number().int().min(1).max(90).default(30),

  /** Where uploads go. Empty = ImageKit when its key is set, otherwise local disk. */
  STORAGE_DRIVER: z
    .enum(["", "local", "imagekit"])
    .optional()
    .transform((v) => v || undefined),
  /** Server-side secret (ImageKit dashboard → Developer options → API keys). */
  IMAGEKIT_PRIVATE_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined),
  IMAGEKIT_URL_ENDPOINT: z.url().default("https://ik.imagekit.io/yyzpkkigy"),
  /** Media-library folder for this app's uploads. */
  IMAGEKIT_FOLDER: z
    .string()
    .regex(/^[\w-]+(\/[\w-]+)*$/, "use letters, digits, - and _ (nested with /)")
    .default("offer-finder"),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  /** Public base URL where uploaded files are served (CDN in production). */
  PUBLIC_UPLOAD_BASE_URL: z.url().default("http://localhost:4000/uploads"),

  /** SMTP connection URL; empty = write emails to MAIL_OUTBOX_DIR (development). */
  SMTP_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined),
  MAIL_FROM: z.string().min(3).default("Mnemonic Reports <reports@offer-finder.com>"),
  MAIL_OUTBOX_DIR: z.string().min(1).default("./outbox"),

  /** Shared Redis for rate limits across API instances. Empty = in-memory (single instance only). */
  REDIS_URL: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(
      z
        .string()
        .regex(/^rediss?:\/\//, "must be a redis:// or rediss:// URL")
        .optional(),
    ),

  SEED_ADMIN_EMAIL: z.email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(12).optional(),

  /** Defaults to true in production. */
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

const envSchema = envFields
  .refine((e) => e.STORAGE_DRIVER !== "imagekit" || e.IMAGEKIT_PRIVATE_KEY, {
    message: "IMAGEKIT_PRIVATE_KEY is required when STORAGE_DRIVER=imagekit",
    path: ["IMAGEKIT_PRIVATE_KEY"],
  })
  .transform((e) => ({
    ...e,
    STORAGE_DRIVER: e.STORAGE_DRIVER ?? (e.IMAGEKIT_PRIVATE_KEY ? "imagekit" : "local"),
  }));

export type Env = z.infer<typeof envSchema>;

const isLocalUrl = (url: string) => /^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url);
const isHttps = (url: string) => url.startsWith("https://");

/**
 * Production safety checks. `errors` stop the API from booting (unsafe or
 * broken in production); `warnings` are logged at startup.
 */
export function productionConfigIssues(config: Env): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (config.NODE_ENV !== "production") return { errors, warnings };

  for (const origin of config.CORS_ORIGINS) {
    if (!isHttps(origin) || isLocalUrl(origin))
      errors.push(`CORS_ORIGINS must be public https origins (got ${origin})`);
  }
  const publicUrls = [
    "PUBLIC_SITE_URL",
    config.STORAGE_DRIVER === "imagekit" ? "IMAGEKIT_URL_ENDPOINT" : "PUBLIC_UPLOAD_BASE_URL",
  ] as const;
  for (const key of publicUrls) {
    if (!isHttps(config[key]) || isLocalUrl(config[key]))
      errors.push(`${key} must be a public https URL`);
  }
  const secrets = [config.SESSION_SECRET, config.ADMIN_SESSION_SECRET, config.OPEN_TOKEN_SECRET];
  if (new Set(secrets).size !== secrets.length) {
    errors.push("SESSION_SECRET, ADMIN_SESSION_SECRET and OPEN_TOKEN_SECRET must all be different");
  }
  if (config.COOKIE_SECURE === false)
    errors.push("COOKIE_SECURE=false is not allowed in production");
  if (!config.RATE_LIMIT_ENABLED)
    errors.push("RATE_LIMIT_ENABLED=false is not allowed in production");
  if (config.SEED_ADMIN_PASSWORD) {
    warnings.push(
      "SEED_ADMIN_PASSWORD is set; remove it from the production environment after the first seed",
    );
  }

  if (config.TRUST_PROXY === 0) {
    warnings.push(
      "TRUST_PROXY=0: behind a load balancer every request shares its IP, so per-IP limits and subnet caps break. Set it to the number of proxies.",
    );
  }
  if (!config.REDIS_URL)
    warnings.push(
      "REDIS_URL is not set: rate limits are per instance (fine only for a single API instance)",
    );
  if (!config.SMTP_URL)
    warnings.push(
      "SMTP_URL is not set: scheduled reports are written to the outbox folder, not emailed",
    );
  if (!config.PROXY_SECRET)
    warnings.push(
      "PROXY_SECRET is not set: every visitor shares the web server's IP, so per-IP limits and unique-open rules break",
    );
  return { errors, warnings };
}

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Fail fast with a readable message; the logger is not available yet.
    const details = z.prettifyError(result.error);
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const { errors } = productionConfigIssues(result.data);
  if (errors.length > 0) {
    throw new Error(
      `Unsafe production configuration:\n${errors.map((e) => `  ✖ ${e}`).join("\n")}`,
    );
  }
  return result.data;
}

/** Validated, typed configuration. Import this instead of reading process.env. */
export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const cookieSecure = env.COOKIE_SECURE ?? isProduction;
