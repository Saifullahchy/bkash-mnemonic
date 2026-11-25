import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardScreen } from "@/features/leaderboard/components/LeaderboardScreen";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return (
    <Suspense>
      <LeaderboardScreen />
    </Suspense>
  );
}
