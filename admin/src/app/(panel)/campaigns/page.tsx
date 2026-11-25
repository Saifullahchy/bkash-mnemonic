import type { Metadata } from "next";
import { Suspense } from "react";
import { CampaignsScreen } from "@/features/campaigns/components/CampaignsScreen";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "Campaigns" };

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsScreen />
    </Suspense>
  );
}
