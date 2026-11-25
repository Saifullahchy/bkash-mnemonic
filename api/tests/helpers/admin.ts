import { hashPassword } from "../../src/core/security/passwords.js";
import { AdminModel, type AdminRole } from "../../src/modules/admin/admin.model.js";
import { testApp } from "./testApp.js";

export const ADMIN_PASSWORD = "correct-horse-battery-staple";

let passwordHash: Promise<string> | undefined;

export async function createAdmin(
  overrides: { email?: string; role?: AdminRole; isActive?: boolean } = {},
) {
  passwordHash ??= hashPassword(ADMIN_PASSWORD); // scrypt is slow on purpose; hash once
  return AdminModel.create({
    name: "Admin User",
    email: overrides.email ?? "admin@example.com",
    role: overrides.role ?? "admin",
    isActive: overrides.isActive ?? true,
    passwordHash: await passwordHash,
  });
}

export async function adminCookie(email = "admin@example.com", app = testApp()): Promise<string> {
  const res = await app
    .post("/v1/admin/auth/login")
    .send({ email, password: ADMIN_PASSWORD })
    .expect(200);
  const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) =>
    c.startsWith("of_admin="),
  );
  if (!cookie) throw new Error("No admin cookie set");
  return cookie.split(";")[0]!;
}

/** Minimal valid PNG header (signature + IHDR) — enough for dimension detection. */
export function fakePng(width: number, height: number, padTo = 0): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "ascii");
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(6, 17); // RGBA
  const png = Buffer.concat([signature, ihdr]);
  return padTo > png.length ? Buffer.concat([png, Buffer.alloc(padTo - png.length)]) : png;
}
