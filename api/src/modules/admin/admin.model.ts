import { Schema, model, type Types } from "mongoose";

export const ADMIN_ROLES = ["admin", "support"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface Admin {
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

const adminSchema = new Schema<Admin>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120 },
    /** scrypt hash (core/security/passwords.ts); never returned unless explicitly selected. */
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, default: "support" },
    isActive: { type: Boolean, default: true },

    lastLoginAt: { type: Date, default: null },
    /** Brute-force protection (phase 5). */
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

adminSchema.index({ email: 1 }, { unique: true });

export type AdminRecord = Admin & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export const AdminModel = model<Admin>("Admin", adminSchema);
