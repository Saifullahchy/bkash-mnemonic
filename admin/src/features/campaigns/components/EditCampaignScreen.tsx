"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api/errors";
import { useGetCampaignQuery } from "../api/campaignsApi";
import { CampaignEditor } from "./form/CampaignEditor";

export function EditCampaignScreen() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useGetCampaignQuery(id);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-7" label="Loading campaign" />
      </div>
    );
  }
  if (!data) {
    const notFound =
      getApiErrorCode(error) === "NOT_FOUND" || getApiErrorCode(error) === "VALIDATION_ERROR";
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-ink font-semibold">
          {notFound ? "Campaign not found" : getApiErrorMessage(error)}
        </p>
        <Link href="/campaigns" className="text-brand-500 text-sm font-semibold hover:underline">
          Back to campaigns
        </Link>
      </div>
    );
  }
  // key: reset the form when navigating between campaigns.
  return <CampaignEditor key={data.id} campaign={data} />;
}
