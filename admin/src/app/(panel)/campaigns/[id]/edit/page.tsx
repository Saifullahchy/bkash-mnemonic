import type { Metadata } from "next";
import { Suspense } from "react";
import { EditCampaignScreen } from "@/features/campaigns/components/EditCampaignScreen";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "Edit campaign" };

export default function EditCampaignPage() {
  return (
    <Suspense>
      <EditCampaignScreen />
    </Suspense>
  );
}
