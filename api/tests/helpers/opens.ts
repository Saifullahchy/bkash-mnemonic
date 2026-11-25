import { NOW } from "./factories.js";
import { loginAs, testApp } from "./testApp.js";

/** A simulated friend: own browser cookie, phone model (UA) and network. */
export interface Friend {
  visitorId: string;
  userAgent: string;
  ip: string;
  acceptLanguage: string;
}

export function friend(n: number, overrides: Partial<Friend> = {}): Friend {
  return {
    visitorId: `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, "0")}`,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel ${n}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36`,
    ip: `10.${n % 250}.${Math.floor(n / 250)}.7`,
    acceptLanguage: "bn-BD,bn;q=0.9,en;q=0.8",
    ...overrides,
  };
}

export const at = (ms: number) => new Date(NOW.getTime() + ms);
const app = (now: Date, rateLimitEnabled = false) =>
  testApp({ now, trustProxy: 1, rateLimitEnabled });

/** Renders the landing page (GET /share/:code) and returns its single-use token. */
export async function landingToken(code: string, now = NOW): Promise<string> {
  const res = await app(now).get(`/v1/share/${code}`).expect(200);
  return res.body.data.openToken as string;
}

interface OpenOptions {
  token?: string;
  now?: Date;
  sessionCookie?: string;
  withVisitorCookie?: boolean;
  honeypot?: string;
  rateLimitEnabled?: boolean;
}

/** The landing page beacon: POST /track/open as `who`, by default 5s after the page rendered. */
export async function openAs(who: Friend, code: string, options: OpenOptions = {}) {
  const token = options.token ?? (await landingToken(code));
  const cookies = [
    ...(options.withVisitorCookie === false ? [] : [`ofv=${who.visitorId}`]),
    ...(options.sessionCookie ? [options.sessionCookie] : []),
  ];
  const req = app(options.now ?? at(5_000), options.rateLimitEnabled)
    .post("/v1/track/open")
    .set("User-Agent", who.userAgent)
    .set("Accept-Language", who.acceptLanguage)
    .set("X-Forwarded-For", who.ip);
  if (cookies.length) void req.set("Cookie", cookies.join("; "));
  return req.send({
    code,
    token,
    ...(options.honeypot === undefined ? {} : { hp: options.honeypot }),
  });
}

export async function counted(who: Friend, code: string, options: OpenOptions = {}) {
  const res = await openAs(who, code, options);
  return res.body.data?.counted as boolean;
}

/** Owner logs in from their own phone and creates their link for the campaign. */
export async function ownerWithLink(
  campaignId: string,
  phone = "01711111111",
  device = friend(900),
) {
  const loginApp = testApp({ trustProxy: 1 });
  const res = await loginApp
    .post("/v1/auth/phone")
    .set("User-Agent", device.userAgent)
    .set("Accept-Language", device.acceptLanguage)
    .set("X-Forwarded-For", device.ip)
    .set("Cookie", `ofv=${device.visitorId}`)
    .send({ phone })
    .expect(200);
  const session = (res.headers["set-cookie"] as unknown as string[])
    .find((c) => c.startsWith("of_session="))!
    .split(";")[0]!;
  const link = await testApp()
    .put(`/v1/campaigns/${campaignId}/link`)
    .set("Cookie", session)
    .expect(201);
  return { code: link.body.data.code as string, session, device };
}

export { loginAs };
