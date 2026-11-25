import type { Metadata } from "next";
import { Suspense } from "react";
import { ParticipantsScreen } from "@/features/participants/components/ParticipantsScreen";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "Participants" };

export default function ParticipantsPage() {
  return (
    <Suspense>
      <ParticipantsScreen />
    </Suspense>
  );
}
