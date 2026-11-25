/** A campaign as returned by GET /v1/campaigns (PublicOfferDto in the API). */
export interface Offer {
  id: string;
  slug: string;
  merchantName: string;
  /** Card heading, e.g. "Foodi Food Fair". */
  title: string;
  /** Card sub-line, e.g. "Tk 200 discount on food orders". */
  subtitle: string;
  description: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  validityLabel: string;
  startAt: string;
  endAt: string;
  status: "live" | "ended";
  reward: {
    title: string;
    rank: number;
    /** Artwork for the whole reward banner; null → the built-in banner. */
    bannerImageUrl: string | null;
    /** Prize picture: shared-link tile and the built-in reward banner. */
    tileImageUrl: string | null;
  };
  /** Unique opens across all participants (public social proof). */
  totalOpens: number;
}

export interface PublicStats {
  peopleSharingToday: number;
}

/** GET /v1/me/activity item: the participant's progress on one live campaign. */
export interface OfferActivity {
  campaignId: string;
  label: string;
  opens: number;
  shares: number;
  link: { code: string; url: string } | null;
}
