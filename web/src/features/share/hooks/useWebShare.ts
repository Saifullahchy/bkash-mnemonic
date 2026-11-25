"use client";

import { useCallback } from "react";
import { useClipboard } from "./useClipboard";

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

/**
 * Opens the native share sheet (WhatsApp, Messenger, …) where supported and
 * falls back to copying the link on desktop browsers.
 * PHASE 3: each successful share also fires `POST /track/share`.
 */
export function useWebShare() {
  const { copied, copy } = useClipboard();

  const share = useCallback(
    async (payload: SharePayload): Promise<"shared" | "copied" | "cancelled"> => {
      if (typeof navigator.share === "function" && navigator.canShare?.(payload) !== false) {
        try {
          await navigator.share(payload);
          return "shared";
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
        }
      }
      return (await copy(payload.url)) ? "copied" : "cancelled";
    },
    [copy],
  );

  return { share, copied };
}
