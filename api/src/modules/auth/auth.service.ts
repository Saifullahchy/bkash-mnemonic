import type { Clock } from "../../core/utils/clock.js";
import type { SessionTokens } from "../../core/security/sessionTokens.js";
import type { ActivityService } from "../activity/activity.service.js";
import type { ParticipantRecord } from "../participant/participant.model.js";
import type { ParticipantRepository } from "../participant/participant.repository.js";

export interface ParticipantDto {
  id: string;
  phone: string;
}

export interface LoginResult {
  participant: ParticipantDto;
  sessionToken: string;
}

const toParticipantDto = (p: ParticipantRecord): ParticipantDto => ({
  id: p._id.toString(),
  phone: p.phone,
});

/**
 * Phone-number login (no OTP, per the current product decision).
 *
 * OTP-ready: when OTP is switched on, `loginWithPhone` becomes step 1
 * ("send code", no session) and a new `verifyOtp(phone, code)` step issues the
 * session through the same `startSession` path — controllers and the web
 * client's session handling stay the same.
 */
export class AuthService {
  constructor(
    private readonly participants: ParticipantRepository,
    private readonly tokens: SessionTokens,
    private readonly clock: Clock,
    private readonly activity: ActivityService,
  ) {}

  /**
   * `binding` ties this browser + device to the participant, so their own
   * opens of their own links are recognised as self-opens later.
   */
  async loginWithPhone(
    phone: string,
    binding: { visitorId?: string; deviceHash?: string } = {},
  ): Promise<LoginResult> {
    const now = this.clock.now();
    const participant = await this.participants.upsertOnLogin(phone, now, binding);
    if (participant.firstLoginAt.getTime() === now.getTime()) {
      await this.activity.record("participant_joined", {
        kind: "participant",
        id: participant._id,
        label: participant.phone,
      });
    }
    return this.startSession(participant);
  }

  /** The logged-in participant, or null if the session points to nobody. */
  async getSessionParticipant(participantId: string): Promise<ParticipantDto | null> {
    const participant = await this.participants.findById(participantId);
    return participant ? toParticipantDto(participant) : null;
  }

  private async startSession(participant: ParticipantRecord): Promise<LoginResult> {
    const sessionToken = await this.tokens.sign({ participantId: participant._id.toString() });
    return { participant: toParticipantDto(participant), sessionToken };
  }
}
