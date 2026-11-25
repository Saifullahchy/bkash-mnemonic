import type { Types } from "mongoose";
import { isValidObjectId } from "mongoose";
import { AdminModel, type AdminRecord, type AdminRole } from "./admin.model.js";

export type AdminWithPassword = AdminRecord & { passwordHash: string };

export class AdminRepository {
  findByEmailWithPassword(email: string): Promise<AdminWithPassword | null> {
    return AdminModel.findOne({ email: email.toLowerCase() })
      .select("+passwordHash")
      .lean<AdminWithPassword>()
      .exec();
  }

  findById(id: string): Promise<AdminRecord | null> {
    if (!isValidObjectId(id)) return Promise.resolve(null);
    return AdminModel.findById(id).lean<AdminRecord>().exec();
  }

  async create(input: { name: string; email: string; passwordHash: string; role: AdminRole }) {
    const doc = await AdminModel.create(input);
    return doc.toObject<AdminRecord>();
  }

  /**
   * Atomically counts a failed login and locks the account once the threshold
   * is reached — one pipeline update, so parallel guesses can't skip the lock.
   */
  async recordFailedLogin(id: Types.ObjectId, now: Date, maxAttempts: number, lockMs: number) {
    await AdminModel.collection.updateOne({ _id: id }, [
      { $set: { failedLoginAttempts: { $add: [{ $ifNull: ["$failedLoginAttempts", 0] }, 1] } } },
      {
        $set: {
          lockedUntil: {
            $cond: [
              { $gte: ["$failedLoginAttempts", maxAttempts] },
              new Date(now.getTime() + lockMs),
              "$lockedUntil",
            ],
          },
          // After a lock, the next window starts from zero.
          failedLoginAttempts: {
            $cond: [{ $gte: ["$failedLoginAttempts", maxAttempts] }, 0, "$failedLoginAttempts"],
          },
        },
      },
    ]);
  }

  async recordSuccessfulLogin(id: Types.ObjectId, now: Date): Promise<void> {
    await AdminModel.updateOne(
      { _id: id },
      { $set: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now } },
    ).exec();
  }
}
