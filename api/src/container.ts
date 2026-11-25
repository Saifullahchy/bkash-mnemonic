import { env } from "./config/env.js";
import { getRedis } from "./config/redis.js";
import { redisRateLimitStore } from "./middlewares/rateLimiter.js";
import type { RateLimitStoreFactory, RouterConfig } from "./routes/routerConfig.js";
import { Fingerprinter } from "./core/security/fingerprint.js";
import { OpenTokens } from "./core/security/openTokens.js";
import { AUDIENCES, SessionTokens } from "./core/security/sessionTokens.js";
import type { FileStorage } from "./core/storage/fileStorage.js";
import { createStorage } from "./core/storage/createStorage.js";
import { OutboxMailer, SmtpMailer, type Mailer } from "./core/mail/mailer.js";
import { systemClock, type Clock } from "./core/utils/clock.js";
import type { RequestHandler } from "express";
import { createAdminAuthMiddleware, type AdminAuthMiddleware } from "./middlewares/adminAuth.js";
import { createAuthMiddleware, type AuthMiddleware } from "./middlewares/auth.js";
import { createVisitorContext } from "./middlewares/visitor.js";
import { ActivityService } from "./modules/activity/activity.service.js";
import { AdminRepository } from "./modules/admin/admin.repository.js";
import { AdminAuthController } from "./modules/admin/auth/adminAuth.controller.js";
import { AdminContentController } from "./modules/admin/content/adminContent.routes.js";
import { ExportsController } from "./modules/admin/exports/exports.routes.js";
import { ExportsService } from "./modules/admin/exports/exports.service.js";
import { ReportService } from "./modules/admin/exports/report.service.js";
import { AdminAuthService } from "./modules/admin/auth/adminAuth.service.js";
import { AdminCampaignController } from "./modules/admin/campaigns/adminCampaign.controller.js";
import { AdminCampaignRepository } from "./modules/admin/campaigns/adminCampaign.repository.js";
import { AdminCampaignService } from "./modules/admin/campaigns/adminCampaign.service.js";
import { DashboardRepository } from "./modules/admin/dashboard/dashboard.repository.js";
import { DashboardController } from "./modules/admin/dashboard/dashboard.routes.js";
import { DashboardService } from "./modules/admin/dashboard/dashboard.service.js";
import { LeaderboardRepository } from "./modules/admin/leaderboard/leaderboard.repository.js";
import { LeaderboardController } from "./modules/admin/leaderboard/leaderboard.routes.js";
import { LeaderboardService } from "./modules/admin/leaderboard/leaderboard.service.js";
import { ModerationRepository } from "./modules/admin/moderation/moderation.repository.js";
import { ModerationService } from "./modules/admin/moderation/moderation.service.js";
import { ParticipantsRepository } from "./modules/admin/participants/participants.repository.js";
import { ParticipantsController } from "./modules/admin/participants/participants.routes.js";
import { ParticipantsService } from "./modules/admin/participants/participants.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { CampaignController } from "./modules/campaign/campaign.controller.js";
import { CampaignRepository } from "./modules/campaign/campaign.repository.js";
import { CampaignService } from "./modules/campaign/campaign.service.js";
import { ContentController } from "./modules/content/content.controller.js";
import { ContentRepository } from "./modules/content/content.repository.js";
import { ContentService } from "./modules/content/content.service.js";
import { ParticipantRepository } from "./modules/participant/participant.repository.js";
import { ShareLinkController } from "./modules/shareLink/shareLink.controller.js";
import { ShareLinkRepository } from "./modules/shareLink/shareLink.repository.js";
import { ShareLinkService } from "./modules/shareLink/shareLink.service.js";
import { StatsController } from "./modules/stats/stats.controller.js";
import { StatsService } from "./modules/stats/stats.service.js";
import {
  AntiAbuseService,
  DeviceCapPolicy,
  DuplicatePolicy,
  EligibilityPolicy,
  HoneypotPolicy,
  OpenTokenPolicy,
  SelfOpenPolicy,
  SubnetCapPolicy,
  VelocityPolicy,
} from "./modules/tracking/policies.js";
import { TrackingController } from "./modules/tracking/tracking.controller.js";
import { TrackingRepository } from "./modules/tracking/tracking.repository.js";
import { TrackingService } from "./modules/tracking/tracking.service.js";

export interface ContainerOverrides {
  clock?: Clock;
  /** Force per-route rate limiters on/off (tests); defaults to RATE_LIMIT_ENABLED. */
  rateLimitEnabled?: boolean;
  /** Number of trusted proxies for req.ip (tests simulate client IPs); defaults to TRUST_PROXY. */
  trustProxy?: number;
  /** Secret of the trusted web/admin servers; defaults to PROXY_SECRET. */
  proxySecret?: string;
  /** Replace file storage (tests use a temp directory). */
  storage?: FileStorage;
  /** Replace the mailer (tests capture sent emails). */
  mailer?: Mailer;
  /** Rate-limit store; defaults to Redis when connected (REDIS_URL), else in-memory. */
  rateLimitStore?: RateLimitStoreFactory;
}

/**
 * What the composition root hands to the app, routers and jobs. Spelled out
 * (instead of ReturnType<typeof buildContainer>) so every consumer sees stable,
 * named types: a type error inside one service stays in that file instead of
 * turning the whole container into `any` for routes (and editor lint warnings
 * such as "unsafe argument of an error typed value").
 */
export interface Container {
  clock: Clock;
  sessionTokens: SessionTokens;
  config: RouterConfig;
  /** Exposed for background jobs (see jobs/scheduler.ts). */
  services: { moderation: ModerationService; reports: ReportService };
  middleware: {
    auth: AuthMiddleware;
    visitor: RequestHandler;
    adminAuth: AdminAuthMiddleware;
  };
  controllers: {
    adminAuth: AdminAuthController;
    adminCampaigns: AdminCampaignController;
    adminContent: AdminContentController;
    exports: ExportsController;
    dashboard: DashboardController;
    leaderboard: LeaderboardController;
    participants: ParticipantsController;
    auth: AuthController;
    campaign: CampaignController;
    content: ContentController;
    shareLink: ShareLinkController;
    stats: StatsController;
    tracking: TrackingController;
  };
}

function redisStoreIfConnected(): RateLimitStoreFactory | undefined {
  const redis = getRedis();
  return redis ? redisRateLimitStore(redis) : undefined;
}

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Composition root: the one place where concrete classes are wired together
 * (constructor injection). Tests pass overrides (e.g. a fixed clock) instead
 * of mocking modules.
 */
export function buildContainer(overrides: ContainerOverrides = {}): Container {
  const clock = overrides.clock ?? systemClock;
  const sessionTokens = new SessionTokens(env.SESSION_SECRET, env.SESSION_TTL_DAYS * DAY_SECONDS);
  const openTokens = new OpenTokens(env.OPEN_TOKEN_SECRET);
  const fingerprinter = new Fingerprinter(env.FINGERPRINT_SALT);
  const adminTokens = new SessionTokens(
    env.ADMIN_SESSION_SECRET,
    env.ADMIN_SESSION_TTL_HOURS * 60 * 60,
    AUDIENCES.admin,
  );
  const storage = overrides.storage ?? createStorage(env);
  const mailer =
    overrides.mailer ??
    (env.SMTP_URL
      ? new SmtpMailer(env.SMTP_URL, env.MAIL_FROM)
      : new OutboxMailer(env.MAIL_OUTBOX_DIR));

  // Repositories
  const campaignRepository = new CampaignRepository();
  const participantRepository = new ParticipantRepository();
  const contentRepository = new ContentRepository();
  const shareLinkRepository = new ShareLinkRepository();
  const trackingRepository = new TrackingRepository();
  const adminRepository = new AdminRepository();
  const adminCampaignRepository = new AdminCampaignRepository();
  const dashboardRepository = new DashboardRepository();
  const leaderboardRepository = new LeaderboardRepository();
  const participantsRepository = new ParticipantsRepository();
  const moderationRepository = new ModerationRepository();

  // Unique-open rules, cheapest first. The token is checked (and consumed) early
  // so a captured token can never be replayed, whatever happens later.
  const antiAbuse = new AntiAbuseService([
    new HoneypotPolicy(),
    new OpenTokenPolicy(openTokens, trackingRepository),
    new EligibilityPolicy(),
    new SelfOpenPolicy(),
    new DuplicatePolicy(trackingRepository),
    new DeviceCapPolicy(trackingRepository),
    new SubnetCapPolicy(trackingRepository),
    new VelocityPolicy(trackingRepository),
  ]);

  // Services
  const activityService = new ActivityService(clock);
  const campaignService = new CampaignService(campaignRepository, clock);
  const statsService = new StatsService(participantRepository, clock);
  const contentService = new ContentService(contentRepository, activityService, clock);
  const authService = new AuthService(participantRepository, sessionTokens, clock, activityService);
  const shareLinkService = new ShareLinkService(
    shareLinkRepository,
    campaignRepository,
    participantRepository,
    clock,
    env.PUBLIC_SITE_URL,
  );
  const adminAuthService = new AdminAuthService(
    adminRepository,
    adminTokens,
    clock,
    env.ADMIN_REMEMBER_DAYS,
  );
  const adminCampaignService = new AdminCampaignService(
    adminCampaignRepository,
    storage,
    clock,
    activityService,
  );
  const dashboardService = new DashboardService(
    dashboardRepository,
    adminCampaignRepository,
    activityService,
    clock,
  );
  const leaderboardService = new LeaderboardService(
    leaderboardRepository,
    adminCampaignRepository,
    activityService,
    clock,
  );
  const exportsService = new ExportsService(activityService, clock);
  const reportService = new ReportService(
    exportsService,
    mailer,
    env.SMTP_URL ? "smtp" : "outbox",
    clock,
  );
  const moderationService = new ModerationService(moderationRepository, activityService, clock);
  const participantsService = new ParticipantsService(
    participantsRepository,
    moderationRepository,
    activityService,
    clock,
  );
  const trackingService = new TrackingService(
    shareLinkRepository,
    campaignRepository,
    participantRepository,
    trackingRepository,
    antiAbuse,
    openTokens,
    clock,
  );

  return {
    clock,
    sessionTokens,
    config: {
      rateLimitEnabled: overrides.rateLimitEnabled ?? env.RATE_LIMIT_ENABLED,
      trustProxy: overrides.trustProxy ?? env.TRUST_PROXY,
      proxySecret: overrides.proxySecret ?? env.PROXY_SECRET,
      rateLimitStore: overrides.rateLimitStore ?? redisStoreIfConnected(),
    },
    services: { moderation: moderationService, reports: reportService },
    middleware: {
      auth: createAuthMiddleware(sessionTokens),
      visitor: createVisitorContext(fingerprinter),
      adminAuth: createAdminAuthMiddleware(adminTokens, adminAuthService),
    },
    controllers: {
      adminAuth: new AdminAuthController(adminAuthService),
      adminCampaigns: new AdminCampaignController(adminCampaignService),
      adminContent: new AdminContentController(contentService),
      exports: new ExportsController(exportsService, reportService),
      dashboard: new DashboardController(dashboardService),
      leaderboard: new LeaderboardController(leaderboardService),
      participants: new ParticipantsController(participantsService, moderationService),
      auth: new AuthController(authService, sessionTokens),
      campaign: new CampaignController(campaignService),
      content: new ContentController(contentService),
      shareLink: new ShareLinkController(shareLinkService),
      stats: new StatsController(statsService),
      tracking: new TrackingController(trackingService),
    },
  };
}
