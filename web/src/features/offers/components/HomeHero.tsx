"use client";

import { useMyActivity } from "../hooks/useMyActivity";
import { HowItWorks } from "./HowItWorks";
import { SharingActivity } from "./SharingActivity";

/** Guests see "how it works"; participants see their own progress instead. */
export function HomeHero({ peopleSharingToday }: { peopleSharingToday: number }) {
  const { activity, isLoading } = useMyActivity();

  if (isLoading) {
    return (
      <div aria-hidden className="bg-brand-50 h-[244px] animate-pulse rounded-2xl md:h-[340px]" />
    );
  }
  if (activity && activity.length > 0) return <SharingActivity activity={activity} />;
  return <HowItWorks peopleSharingToday={peopleSharingToday} />;
}
