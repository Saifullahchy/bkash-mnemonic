/**
 * Creates an admin account (use for production; `npm run seed` is dev-only).
 *
 *   ADMIN_EMAIL=ops@example.com ADMIN_NAME="Ops" ADMIN_ROLE=admin \
 *   ADMIN_PASSWORD='…' npm run admin:create
 *
 * The password is read from the environment so it never appears in shell
 * history arguments or logs; use at least 12 characters.
 */
import { z } from "zod";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { hashPassword } from "../core/security/passwords.js";
import { ADMIN_ROLES, AdminModel } from "../modules/admin/admin.model.js";

const input = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_NAME: z.string().trim().min(1).max(80),
    ADMIN_ROLE: z.enum(ADMIN_ROLES).default("admin"),
    ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD must be at least 12 characters"),
  })
  .parse(process.env);

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  if (await AdminModel.exists({ email: input.ADMIN_EMAIL.toLowerCase() })) {
    throw new Error(`An admin with email ${input.ADMIN_EMAIL} already exists`);
  }
  await AdminModel.create({
    name: input.ADMIN_NAME,
    email: input.ADMIN_EMAIL,
    role: input.ADMIN_ROLE,
    passwordHash: await hashPassword(input.ADMIN_PASSWORD),
  });
  logger.info({ email: input.ADMIN_EMAIL, role: input.ADMIN_ROLE }, "Admin created");
}

main()
  .catch((error: unknown) => {
    logger.error({ err: error }, "Could not create admin");
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
