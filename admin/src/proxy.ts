import { NextResponse, type NextRequest } from "next/server";

/** Must match ADMIN_SESSION_COOKIE in offer-finder-api. */
const ADMIN_COOKIE = "of_admin";

/**
 * Fast redirect for signed-out visitors before any page renders. This only
 * checks that a session cookie exists; the API verifies it on every request
 * and the panel layout sends anyone with an invalid session back to /login.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(ADMIN_COOKIE);
  const { pathname, search } = request.nextUrl;

  if (!hasSession && pathname !== "/login") {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the API (it checks the session itself), health probe, Next internals and files.
  matcher: [
    "/((?!api/|healthz|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
