import { AppError } from "../../../core/errors/AppError.js";
import { getDummyHash, verifyPassword } from "../../../core/security/passwords.js";
import type { SessionTokens } from "../../../core/security/sessionTokens.js";
import type { Clock } from "../../../core/utils/clock.js";
import type { AdminRecord, AdminRole } from "../admin.model.js";
import type { AdminRepository } from "../admin.repository.js";

export const MAX_FAILED_LOGINS = 10;
export const LOCK_DURATION_MS = 15 * 60_000;

export interface AdminDto {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export const toAdminDto = (admin: AdminRecord): AdminDto => ({
  id: admin._id.toString(),
  name: admin.name,
  email: admin.email,
  role: admin.role,
});

/** Same message for unknown email and wrong password (no account enumeration). */
export class InvalidCredentialsError extends AppError {
  constructor() {
    super("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }
}

export class AccountLockedError extends AppError {
  constructor() {
    super("Too many failed attempts. Try again in 15 minutes.", 429, "ACCOUNT_LOCKED");
  }
}

export interface AdminLoginResult {
  admin: AdminDto;
  token: string;
  /** Cookie lifetime; undefined = browser-session cookie. */
  cookieMaxAgeMs: number | undefined;
}

export class AdminAuthService {
  constructor(
    private readonly admins: AdminRepository,
    private readonly tokens: SessionTokens,
    private readonly clock: Clock,
    private readonly rememberDays: number,
  ) {}

  async login(email: string, password: string, remember: boolean): Promise<AdminLoginResult> {
    const now = this.clock.now();
    const admin = await this.admins.findByEmailWithPassword(email);

    if (!admin) {
      await verifyPassword(password, await getDummyHash()); // equalise timing
      throw new InvalidCredentialsError();
    }
    if (admin.lockedUntil && admin.lockedUntil > now) throw new AccountLockedError();

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid || !admin.isActive) {
      if (!valid)
        await this.admins.recordFailedLogin(admin._id, now, MAX_FAILED_LOGINS, LOCK_DURATION_MS);
      throw new InvalidCredentialsError();
    }

    await this.admins.recordSuccessfulLogin(admin._id, now);
    const rememberSeconds = this.rememberDays * 24 * 60 * 60;
    const token = remember
      ? await this.tokens.signSubject(admin._id.toString(), rememberSeconds)
      : await this.tokens.signSubject(admin._id.toString());

    return {
      admin: toAdminDto(admin),
      token,
      cookieMaxAgeMs: remember ? rememberSeconds * 1000 : undefined,
    };
  }

  /** Active admin for a session id, re-checked on every request (deactivation is immediate). */
  async getActiveAdmin(id: string): Promise<AdminRecord | null> {
    const admin = await this.admins.findById(id);
    return admin?.isActive ? admin : null;
  }
}
