"use client";

import { useEffect, useRef } from "react";
import { useTrackOpenMutation } from "../api/trackingApi";

/** Must exceed the API's 2s minimum token age, with margin for clock drift. */
const MIN_VISIBLE_MS = 2500;

/**
 * Reports that a real person viewed the share page: fires once, only after the
 * page has been *visible* for MIN_VISIBLE_MS (background tabs and instant
 * bounces don't count). Link-preview crawlers never run this script at all.
 * Renders nothing; the API decides whether the open counts.
 */
export function OpenBeacon({ code, token }: { code: string; token: string }) {
  const [trackOpen] = useTrackOpenMutation();
  const sent = useRef(false);

  useEffect(() => {
    let visibleMs = 0;
    let visibleSince: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const send = () => {
      if (sent.current) return;
      sent.current = true;
      void trackOpen({ code, token, hp: "" });
    };

    const schedule = () => {
      if (document.visibilityState !== "visible" || sent.current) return;
      visibleSince = performance.now();
      timer = setTimeout(send, Math.max(0, MIN_VISIBLE_MS - visibleMs));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        schedule();
      } else {
        clearTimeout(timer);
        if (visibleSince !== null) visibleMs += performance.now() - visibleSince;
        visibleSince = null;
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [code, token, trackOpen]);

  return null;
}
