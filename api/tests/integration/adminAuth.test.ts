import { describe, expect, it } from "vitest";
import { AdminModel } from "../../src/modules/admin/admin.model.js";
import { adminCookie, ADMIN_PASSWORD, createAdmin } from "../helpers/admin.js";
import { NOW } from "../helpers/factories.js";
import { loginAs, testApp } from "../helpers/testApp.js";

const login = (body: Record<string, unknown>, app = testApp()) =>
  app.post("/v1/admin/auth/login").send(body);

describe("POST /v1/admin/auth/login", () => {
  it("signs in with an httpOnly, SameSite=Strict, browser-session cookie", async () => {
    await createAdmin();
    const res = await login({ email: "ADMIN@example.com", password: ADMIN_PASSWORD }).expect(200);

    expect(res.body.data.admin).toEqual({
      id: expect.any(String),
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    const cookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toMatch(/of_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).not.toMatch(/Max-Age/i);
  });

  it("keeps the admin signed in for 30 days with 'Keep me signed in'", async () => {
    await createAdmin();
    const res = await login({
      email: "admin@example.com",
      password: ADMIN_PASSWORD,
      remember: true,
    });
    const cookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toMatch(/Max-Age=2592000/);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await createAdmin();
    const wrong = await login({ email: "admin@example.com", password: "nope" }).expect(401);
    const unknown = await login({ email: "ghost@example.com", password: "nope" }).expect(401);
    expect(wrong.body.error).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it("locks the account for 15 minutes after 10 failed attempts", async () => {
    await createAdmin();
    for (let i = 0; i < 10; i++) {
      await login({ email: "admin@example.com", password: `wrong-${i}` }).expect(401);
    }
    const locked = await login({ email: "admin@example.com", password: ADMIN_PASSWORD }).expect(
      429,
    );
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");

    const later = testApp(new Date(NOW.getTime() + 16 * 60_000));
    await login({ email: "admin@example.com", password: ADMIN_PASSWORD }, later).expect(200);
    expect((await AdminModel.findOne().lean())?.failedLoginAttempts).toBe(0);
  });

  it("refuses deactivated admins", async () => {
    await createAdmin({ isActive: false });
    await login({ email: "admin@example.com", password: ADMIN_PASSWORD }).expect(401);
  });

  it("rate-limits failed attempts per IP (successful logins don't count)", async () => {
    await createAdmin();
    const app = testApp({ rateLimitEnabled: true });
    for (let i = 0; i < 3; i++) {
      await login({ email: "admin@example.com", password: ADMIN_PASSWORD }, app).expect(200);
    }
    for (let i = 0; i < 5; i++) {
      await login({ email: "someone@example.com", password: "x" }, app).expect(401);
    }
    const res = await login({ email: "someone@example.com", password: "x" }, app).expect(429);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});

describe("admin session", () => {
  it("returns the current admin from /me", async () => {
    await createAdmin();
    const cookie = await adminCookie();
    const res = await testApp().get("/v1/admin/auth/me").set("Cookie", cookie).expect(200);
    expect(res.body.data.admin.email).toBe("admin@example.com");
  });

  it("requires a session for every admin route", async () => {
    await testApp().get("/v1/admin/auth/me").expect(401);
    await testApp().get("/v1/admin/campaigns").expect(401);
  });

  it("revokes access immediately when an admin is deactivated", async () => {
    const admin = await createAdmin();
    const cookie = await adminCookie();
    await AdminModel.updateOne({ _id: admin._id }, { isActive: false });
    await testApp().get("/v1/admin/auth/me").set("Cookie", cookie).expect(401);
  });

  it("never accepts participant and admin tokens in place of each other", async () => {
    await createAdmin();
    const admin = (await adminCookie()).split("=")[1];
    const participant = (await loginAs()).cookie.split("=")[1];

    await testApp().get("/v1/admin/auth/me").set("Cookie", `of_admin=${participant}`).expect(401);
    const session = await testApp().get("/v1/auth/session").set("Cookie", `of_session=${admin}`);
    expect(session.body.data.participant).toBeNull();
  });

  it("clears the cookie on logout", async () => {
    const res = await testApp().post("/v1/admin/auth/logout").expect(200);
    expect((res.headers["set-cookie"] as unknown as string[]).join(";")).toMatch(/of_admin=;/);
  });
});
