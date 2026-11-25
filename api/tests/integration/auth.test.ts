import { describe, expect, it } from "vitest";
import { ParticipantModel } from "../../src/modules/participant/participant.model.js";
import { MAX_BOUND_VISITORS } from "../../src/modules/participant/participant.repository.js";
import { daysFrom, NOW } from "../helpers/factories.js";
import { loginAs, testApp } from "../helpers/testApp.js";

const VISITOR = "3f2b8c1e-9d4a-4b6f-8a2e-1c5d7e9f0a1b";

describe("POST /v1/auth/phone", () => {
  it("normalises the number, creates the participant and sets an httpOnly session cookie", async () => {
    const res = await testApp()
      .post("/v1/auth/phone")
      .send({ phone: "+880 1712-345678" })
      .expect(200);

    expect(res.body.data.participant).toEqual({ id: expect.any(String), phone: "01712345678" });
    const cookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toMatch(/of_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("logs the same number into the same participant, keeping firstLoginAt", async () => {
    const first = await loginAs("01712345678", testApp(NOW));
    const second = await loginAs("01712345678", testApp(daysFrom(NOW, 2)));

    expect(second.participantId).toBe(first.participantId);
    const participant = await ParticipantModel.findById(first.participantId).lean();
    expect(participant?.firstLoginAt).toEqual(NOW);
    expect(participant?.lastActiveAt).toEqual(daysFrom(NOW, 2));
    expect(await ParticipantModel.countDocuments()).toBe(1);
  });

  it.each([["0171234567"], ["01212345678"], ["abc"], [""]])(
    "rejects invalid number %j with 400",
    async (phone) => {
      const res = await testApp().post("/v1/auth/phone").send({ phone }).expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("rejects unknown fields (strict body)", async () => {
    await testApp()
      .post("/v1/auth/phone")
      .send({ phone: "01712345678", isAdmin: true })
      .expect(400);
  });

  it("binds the visitor cookie and device (deduplicated) for self-open detection", async () => {
    const { participantId } = await loginAs("01712345678", testApp(), `ofv=${VISITOR}`);
    await loginAs("01712345678", testApp(), `ofv=${VISITOR}`);

    const participant = await ParticipantModel.findById(participantId).lean();
    expect(participant?.visitorIds).toEqual([VISITOR]);
    expect(participant?.deviceHashes).toHaveLength(1);
  });

  it("replaces a malformed visitor cookie with a fresh one (and binds that)", async () => {
    const res = await testApp()
      .post("/v1/auth/phone")
      .set("Cookie", "ofv=not-a-uuid")
      .send({ phone: "01712345678" })
      .expect(200);

    const setCookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    const issued = /ofv=([0-9a-f-]{36})/.exec(setCookie)?.[1];
    expect(issued).toBeDefined();
    const participant = await ParticipantModel.findOne({ phone: "01712345678" }).lean();
    expect(participant?.visitorIds).toEqual([issued]);
  });

  it(`keeps only the latest ${MAX_BOUND_VISITORS} visitor ids`, async () => {
    let participantId = "";
    for (let i = 0; i < MAX_BOUND_VISITORS + 3; i++) {
      const visitor = `3f2b8c1e-9d4a-4b6f-8a2e-${String(i).padStart(12, "0")}`;
      ({ participantId } = await loginAs("01712345678", testApp(), `ofv=${visitor}`));
    }
    const participant = await ParticipantModel.findById(participantId).lean();
    expect(participant?.visitorIds).toHaveLength(MAX_BOUND_VISITORS);
    expect(participant?.visitorIds.at(-1)).toBe("3f2b8c1e-9d4a-4b6f-8a2e-000000000022");
  });

  it("rate-limits repeated logins for the same number (429)", async () => {
    const app = testApp({ rateLimitEnabled: true });
    for (let i = 0; i < 5; i++) {
      await app.post("/v1/auth/phone").send({ phone: "01712345678" }).expect(200);
    }
    const res = await app.post("/v1/auth/phone").send({ phone: "+8801712345678" }).expect(429);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");

    // A different number from the same IP is still allowed.
    await app.post("/v1/auth/phone").send({ phone: "01812345678" }).expect(200);
  });
});

describe("session & logout", () => {
  it("returns participant: null for guests (200, not 401)", async () => {
    const res = await testApp().get("/v1/auth/session").expect(200);
    expect(res.body.data).toEqual({ participant: null });
  });

  it("returns the participant for a valid session", async () => {
    const { cookie, participantId } = await loginAs();
    const res = await testApp().get("/v1/auth/session").set("Cookie", cookie).expect(200);
    expect(res.body.data.participant).toEqual({ id: participantId, phone: "01712345678" });
  });

  it("treats a tampered token as a guest", async () => {
    const { cookie } = await loginAs();
    const tampered = `${cookie.slice(0, -4)}AAAA`;
    const res = await testApp().get("/v1/auth/session").set("Cookie", tampered).expect(200);
    expect(res.body.data.participant).toBeNull();
  });

  it("clears the cookie on logout", async () => {
    const res = await testApp().post("/v1/auth/logout").expect(200);
    const cookie = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cookie).toMatch(/of_session=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
