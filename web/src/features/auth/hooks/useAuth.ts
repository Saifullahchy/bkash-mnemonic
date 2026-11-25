"use client";

import { useHydrated } from "@/lib/hooks/useHydrated";
import { useGetSessionQuery } from "../api/authApi";

/**
 * Current participant from the API session (httpOnly cookie).
 * `isLoading` stays true until hydrated: the server can't know the session,
 * so server HTML and the first client render must both show the loading state.
 */
export function useAuth() {
  const hydrated = useHydrated();
  const { data, isLoading } = useGetSessionQuery();
  const participant = hydrated ? (data?.participant ?? null) : null;
  return {
    participant,
    phone: participant?.phone ?? null,
    isAuthenticated: !!participant,
    isLoading: !hydrated || isLoading,
  };
}
