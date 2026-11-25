"use client";

import Lenis from "lenis";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useAppSelector } from "@/store/hooks";

/**
 * Premium scrolling:
 * - Lenis smooths mouse-wheel / trackpad scrolling (eases to a stop instead of
 *   jumping). Touch keeps the phone's native scrolling, which already has momentum.
 * - Pauses while a popup is open so the page behind never moves.
 * - Adds `motion-ready` to <html>, which turns on the scroll-reveal styles
 *   (see Reveal and globals.css). Nothing is hidden before JavaScript runs.
 * Everything is skipped when the user prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const modalOpen = useAppSelector((state) => state.ui.modal !== null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("motion-ready");
    return () => document.documentElement.classList.remove("motion-ready");
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.09, // lower = longer, silkier glide
      wheelMultiplier: 0.9,
      smoothWheel: true,
      // Popups and anything marked data-lenis-prevent keep their own native scrolling.
      prevent: (node) => node.closest("dialog, [data-lenis-prevent]") !== null,
    });
    lenisRef.current = lenis;

    let frame = requestAnimationFrame(function raf(time: number) {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (modalOpen) lenis.stop();
    else lenis.start();
  }, [modalOpen]);

  return children;
}
