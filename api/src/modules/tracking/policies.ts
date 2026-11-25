import type { OpenTokens } from "../../core/security/openTokens.js";
import { getCampaignLifecycle } from "../campaign/campaign.domain.js";
import type { CampaignRecord } from "../campaign/campaign.model.js";
import type { ParticipantRecord } from "../participant/participant.model.js";
import type { ShareLinkRecord } from "../shareLink/shareLink.model.js";
import type { OpenReason } from "./linkOpen.model.js";
import type { TrackingRepository } from "./tracking.repository.js";

/** Everything known about one attempt to count a link open. */
export interface OpenContext {
  link: ShareLinkRecord;
  campaign: CampaignRecord | null;
  owner: ParticipantRecord | null;
  token: string;
  honeypot: string | undefined;
  visitorId: string;
  deviceHash: string;
  subnetHash: string;
  /** Logged-in participant making the request, if any. */
  sessionParticipantId: string | undefined;
  now: Date;
}

/**
 * One anti-abuse rule. Returns the rejection reason, or null to pass.
 * Policies are small, independently testable and run in order (cheap first);
 * adding a rule means adding a class to the list in the container.
 */
export interface OpenPolicy {
  readonly name: string;
  evaluate(ctx: OpenContext): Promise<OpenReason | null>;
}

const MINUTE = 60_000;

/** A script must not be able to fill hidden fields a real page never sends. */
export class HoneypotPolicy implements OpenPolicy {
  readonly name = "honeypot";
  evaluate(ctx: OpenContext) {
    return Promise.resolve(ctx.honeypot ? ("bot" as const) : null);
  }
}

/** Valid, page-issued, ≥2s old, unexpired and never used before (single use). */
export class OpenTokenPolicy implements OpenPolicy {
  readonly name = "open-token";
  constructor(
    private readonly tokens: OpenTokens,
    private readonly repo: TrackingRepository,
  ) {}

  async evaluate(ctx: OpenContext) {
    const check = this.tokens.verify(ctx.token, ctx.link.code, ctx.now);
    if (!check.ok) return "invalid_token" as const;
    const fresh = await this.repo.consumeNonce(check.claims.nonce, ctx.now);
    return fresh ? null : ("invalid_token" as const);
  }
}

/** The campaign must be live and counting; the link and owner must be in good standing. */
export class EligibilityPolicy implements OpenPolicy {
  readonly name = "eligibility";
  evaluate(ctx: OpenContext) {
    const { campaign, owner, link } = ctx;
    if (!campaign || !campaign.settings.countLinkOpens)
      return Promise.resolve("campaign_inactive" as const);
    if (getCampaignLifecycle(campaign, ctx.now) !== "live")
      return Promise.resolve("campaign_inactive" as const);
    if (link.flags.frozen || !owner || owner.status !== "active")
      return Promise.resolve("link_frozen" as const);
    return Promise.resolve(null);
  }
}

/** The owner opening their own link (same session, same browser, or same device) never counts. */
export class SelfOpenPolicy implements OpenPolicy {
  readonly name = "self-open";
  evaluate(ctx: OpenContext) {
    const ownerId = ctx.link.participantId.toString();
    const isSelf =
      ctx.sessionParticipantId === ownerId ||
      (ctx.owner?.visitorIds.includes(ctx.visitorId) ?? false) ||
      (ctx.owner?.deviceHashes.includes(ctx.deviceHash) ?? false);
    return Promise.resolve(isSelf ? ("self_open" as const) : null);
  }
}

/** One count per link per browser AND per device (refresh, re-open, incognito). */
export class DuplicatePolicy implements OpenPolicy {
  readonly name = "duplicate";
  constructor(private readonly repo: TrackingRepository) {}
  async evaluate(ctx: OpenContext) {
    const seen = await this.repo.hasCountedOpen(ctx.link._id, ctx.visitorId, ctx.deviceHash);
    return seen ? ("duplicate" as const) : null;
  }
}

/** One device can boost at most N different people's links per campaign. */
export class DeviceCapPolicy implements OpenPolicy {
  readonly name = "device-cap";
  constructor(private readonly repo: TrackingRepository) {}
  async evaluate(ctx: OpenContext) {
    const max = ctx.campaign?.settings.antiAbuse.maxLinksPerDevice ?? 3;
    const used = await this.repo.countCountedLinksForDevice(
      ctx.link.campaignId,
      ctx.visitorId,
      ctx.deviceHash,
    );
    return used >= max ? ("device_cap" as const) : null;
  }
}

/** Throttles proxy/VPN farms: max K counted opens per link per network per hour. */
export class SubnetCapPolicy implements OpenPolicy {
  readonly name = "subnet-cap";
  constructor(private readonly repo: TrackingRepository) {}
  async evaluate(ctx: OpenContext) {
    const max = ctx.campaign?.settings.antiAbuse.maxOpensPerSubnetPerHour ?? 5;
    const since = new Date(ctx.now.getTime() - 60 * MINUTE);
    const used = await this.repo.countCountedFromSubnetSince(ctx.link._id, ctx.subnetHash, since);
    return used >= max ? ("subnet_cap" as const) : null;
  }
}

/** Flattens sudden bursts on one link: max counted opens per 10 minutes. */
export class VelocityPolicy implements OpenPolicy {
  readonly name = "velocity";
  constructor(private readonly repo: TrackingRepository) {}
  async evaluate(ctx: OpenContext) {
    const max = ctx.campaign?.settings.antiAbuse.maxOpensPerLinkPer10Min ?? 50;
    const since = new Date(ctx.now.getTime() - 10 * MINUTE);
    const used = await this.repo.countCountedSince(ctx.link._id, since);
    return used >= max ? ("velocity_cap" as const) : null;
  }
}

/** Runs policies in order and returns the first rejection, or "counted". */
export class AntiAbuseService {
  constructor(private readonly policies: readonly OpenPolicy[]) {}

  async evaluate(ctx: OpenContext): Promise<OpenReason> {
    for (const policy of this.policies) {
      const reason = await policy.evaluate(ctx);
      if (reason) return reason;
    }
    return "counted";
  }
}
