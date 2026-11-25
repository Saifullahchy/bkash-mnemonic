import { jwtVerify, SignJWT, errors as joseErrors } from "jose";

export interface SessionClaims {
  /** Subject: participant id or admin id. */
  subjectId: string;
}

/** Participant session (offer site). */
export interface ParticipantSession {
  participantId: string;
}

const ISSUER = "offer-finder-api";
const ALGORITHM = "HS256";

export const AUDIENCES = {
  participant: "offer-finder-participant",
  admin: "offer-finder-admin",
} as const;

/**
 * Stateless sessions: a short JWT (subject = user id) carried in an httpOnly
 * cookie. Participant and admin tokens use different secrets AND audiences, so
 * neither can ever be replayed as the other.
 */
export class SessionTokens {
  private readonly key: Uint8Array;

  constructor(
    secret: string,
    private readonly ttlSeconds: number,
    private readonly audience: string = AUDIENCES.participant,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  get maxAgeMs(): number {
    return this.ttlSeconds * 1000;
  }

  /** Participant-flavoured helpers (kept for readability at call sites). */
  sign(session: ParticipantSession): Promise<string> {
    return this.signSubject(session.participantId);
  }

  async verify(token: string | undefined): Promise<ParticipantSession | null> {
    const claims = await this.verifySubject(token);
    return claims ? { participantId: claims.subjectId } : null;
  }

  signSubject(subjectId: string, ttlSeconds = this.ttlSeconds): Promise<string> {
    return new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM })
      .setSubject(subjectId)
      .setIssuer(ISSUER)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.key);
  }

  /** Returns the claims, or null for a missing/expired/tampered/foreign token. */
  async verifySubject(token: string | undefined): Promise<SessionClaims | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: this.audience,
        algorithms: [ALGORITHM],
      });
      return payload.sub ? { subjectId: payload.sub } : null;
    } catch (error) {
      if (error instanceof joseErrors.JOSEError) return null;
      throw error;
    }
  }
}
