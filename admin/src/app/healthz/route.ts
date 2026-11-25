/** Liveness probe for the host (does not touch the API). */
export function GET() {
  return Response.json({ status: "ok" });
}
