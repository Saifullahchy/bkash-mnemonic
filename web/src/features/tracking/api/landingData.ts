import "server-only";
import { cache } from "react";
import { apiGetOptional } from "@/lib/api/server";
import type { ShareLanding } from "../types";

const SHARE_CODE = /^[0-9A-Za-z]{8}$/;

/**
 * Landing data for /s/{code}, or null for unknown codes. Wrapped in React
 * `cache` so generateMetadata and the page share ONE request per render
 * (each request mints a fresh single-use open token).
 */
export const getShareLanding = cache(async (code: string): Promise<ShareLanding | null> => {
  if (!SHARE_CODE.test(code)) return null;
  return apiGetOptional<ShareLanding>(`/share/${code}`);
});
