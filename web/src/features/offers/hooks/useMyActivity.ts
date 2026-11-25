"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { useGetMyActivityQuery } from "../api/activityApi";
import type { OfferActivity } from "../types";

/** Logged-in participant's progress per live campaign (null for guests). */
export function useMyActivity(): { activity: OfferActivity[] | null; isLoading: boolean } {
  const { isAuthenticated, isLoading: sessionLoading } = useAuth();
  const { data, isLoading } = useGetMyActivityQuery(undefined, { skip: !isAuthenticated });
  return {
    activity: isAuthenticated ? (data ?? null) : null,
    isLoading: sessionLoading || (isAuthenticated && isLoading),
  };
}

/** The participant's activity for one campaign (null for guests / not loaded). */
export function useMyActivityFor(campaignId: string): OfferActivity | null {
  const { activity } = useMyActivity();
  return activity?.find((item) => item.campaignId === campaignId) ?? null;
}
