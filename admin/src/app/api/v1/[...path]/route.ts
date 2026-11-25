import { forwardToApi } from "@/lib/api/forward";

/**
 * Same-origin API: the browser calls /api/v1/* on this site and the server forwards it to the
 * API. Cookies stay first-party, whatever domains the services run on.
 */
async function handler(request: Request, { params }: RouteContext<"/api/v1/[...path]">) {
  const { path } = await params;
  return forwardToApi(request, path);
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
