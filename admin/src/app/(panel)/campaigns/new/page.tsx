import type { Metadata } from "next";
import { CampaignEditor } from "@/features/campaigns/components/form/CampaignEditor";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "New campaign" };

export default function NewCampaignPage() {
  return <CampaignEditor />;
}
