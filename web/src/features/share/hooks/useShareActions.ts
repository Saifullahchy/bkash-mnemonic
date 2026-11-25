"use client";

import { useCallback } from "react";
import type { Offer } from "@/features/offers/types";
import { useTrackShareMutation } from "../api/shareApi";
import { useClipboard } from "./useClipboard";
import { useWebShare } from "./useWebShare";

/**
 * Copy / native-share for a participant's link. Every successful copy or share
 * is reported to the API (`POST /track/share`, de-duplicated server-side), and
 * a tracking failure never blocks the user.
 */
export function useShareActions(offer: Pick<Offer, "id" | "title" | "subtitle">) {
  const { copied, copyCount, copy } = useClipboard();
  const { share, copied: copiedByShare } = useWebShare();
  const [trackShare] = useTrackShareMutation();

  const track = useCallback(() => {
    void trackShare({ campaignId: offer.id });
  }, [trackShare, offer.id]);

  const copyLink = useCallback(
    async (url: string) => {
      if (await copy(url)) track();
    },
    [copy, track],
  );

  const shareLink = useCallback(
    async (url: string) => {
      const outcome = await share({
        title: offer.title,
        text: `${offer.title} — ${offer.subtitle}`,
        url,
      });
      if (outcome !== "cancelled") track();
    },
    [share, track, offer.title, offer.subtitle],
  );

  return { copyLink, shareLink, copied: copied || copiedByShare, copyCount };
}
