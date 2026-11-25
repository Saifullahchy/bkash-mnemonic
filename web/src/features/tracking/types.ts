import type { Offer } from "@/features/offers/types";

/** GET /v1/share/:code */
export interface ShareLanding {
  code: string;
  offer: Offer;
  /** Single-use proof of a page view; null when the campaign no longer counts opens. */
  openToken: string | null;
}
