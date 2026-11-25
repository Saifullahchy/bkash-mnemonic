"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during SSR and the hydration render, true afterwards. Lets components
 * that depend on browser-only state (cookies → session) render the same
 * markup on the server and the first client pass, avoiding hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
