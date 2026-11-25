import "server-only";
import type { Terms } from "@/features/terms/types";
import { apiGet, apiGetOptional } from "@/lib/api/server";
import type { Offer, PublicStats } from "../types";

export interface HomePageData {
  offers: Offer[];
  stats: PublicStats;
  /** Null until an admin publishes Terms & Conditions. */
  terms: Terms | null;
}

/**
 * Public home page data, fetched in parallel on the server at request time
 * (the API sets short Cache-Control headers and caches stats itself).
 */
export async function getHomePageData(): Promise<HomePageData> {
  const [offers, stats, terms] = await Promise.all([
    apiGet<Offer[]>("/campaigns"),
    apiGet<PublicStats>("/stats/public"),
    apiGetOptional<Terms>("/content/terms"),
  ]);
  return { offers, stats, terms };
}
