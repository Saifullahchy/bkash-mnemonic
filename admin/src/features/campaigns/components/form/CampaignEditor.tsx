"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/Card";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { useToast } from "@/components/ui/Toast";
import { useMeQuery } from "@/features/auth/api/authApi";
import { getApiErrorMessage } from "@/lib/api/errors";
import { inputToDayMonth } from "@/lib/dates";
import {
  useCreateCampaignMutation,
  usePublishCampaignMutation,
  useUpdateCampaignMutation,
  useUploadCampaignMediaMutation,
} from "../../api/campaignsApi";
import {
  campaignFormSchema,
  campaignToForm,
  emptyCampaignForm,
  formToInput,
  readinessOf,
  type CampaignFormValues,
} from "../../lib/campaignForm";
import { MEDIA_RULES } from "../../lib/imageCheck";
import type { AdminCampaign, MediaKind } from "../../types";
import { LivePreview } from "./LivePreview";
import { MediaDropzone } from "./MediaDropzone";
import { PublishingCard } from "./PublishingCard";
import { BasicInfoSection, RewardSection, ScheduleSection, SharingSection } from "./sections";

type PendingMedia = Partial<Record<MediaKind, { file: File; previewUrl: string }>>;
type SubmitIntent = "draft" | "publish" | "save";

/**
 * Create / edit a campaign. Selected images are queued locally (a new campaign
 * has no id yet) and uploaded right after the campaign is saved; publishing
 * then runs the server's readiness checks.
 */
export function CampaignEditor({ campaign }: { campaign?: AdminCampaign }) {
  const router = useRouter();
  const toast = useToast();
  const { data: me } = useMeQuery();
  const canEdit = me?.role === "admin";

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: campaign ? campaignToForm(campaign) : emptyCampaignForm(),
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control });

  const [pending, setPending] = useState<PendingMedia>({});
  const [busy, setBusy] = useState<SubmitIntent | null>(null);
  const [createCampaign] = useCreateCampaignMutation();
  const [updateCampaign] = useUpdateCampaignMutation();
  const [uploadMedia] = useUploadCampaignMediaMutation();
  const [publishCampaign] = usePublishCampaignMutation();

  // Object URLs for queued images: revoked when replaced, and all of them on unmount.
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const selectMedia = (kind: MediaKind, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.add(previewUrl);
    setPending((current) => {
      const previous = current[kind]?.previewUrl;
      if (previous) {
        URL.revokeObjectURL(previous);
        previewUrls.current.delete(previous);
      }
      return { ...current, [kind]: { file, previewUrl } };
    });
  };

  const bannerUrl = pending.banner?.previewUrl ?? campaign?.media.bannerUrl ?? null;
  const rewardImageUrl = pending["reward-banner"]?.previewUrl ?? campaign?.reward.imageUrl ?? null;
  const prizeTileUrl = pending["prize-tile"]?.previewUrl ?? campaign?.reward.tileImageUrl ?? null;
  // Same fallback as the app: without its own picture the tile shows the reward banner's.
  const shownTileUrl = prizeTileUrl ?? rewardImageUrl;
  const readiness = readinessOf(values, {
    banner: Boolean(bannerUrl),
    rewardImage: Boolean(rewardImageUrl),
    prizeTile: Boolean(shownTileUrl),
  });
  const isPublished = campaign?.status === "published";

  const submit = (intent: SubmitIntent) =>
    form.handleSubmit(async (formValues) => {
      setBusy(intent);
      try {
        const input = formToInput(formValues);
        const saved = campaign
          ? await updateCampaign({ id: campaign.id, body: input })
          : await createCampaign(input);
        if (saved.error) return toast.error(getApiErrorMessage(saved.error));
        const id = saved.data.id;

        for (const kind of ["banner", "reward-banner", "prize-tile"] as const) {
          const media = pending[kind];
          if (!media) continue;
          const uploaded = await uploadMedia({ id, kind, file: media.file });
          if (uploaded.error) {
            toast.error(
              `${MEDIA_RULES[kind].label} upload failed: ${getApiErrorMessage(uploaded.error)}`,
            );
            if (!campaign) router.replace(`/campaigns/${id}/edit`);
            return;
          }
        }
        setPending({});

        if (intent === "publish") {
          const published = await publishCampaign(id);
          if (published.error) {
            toast.error(getApiErrorMessage(published.error));
            if (!campaign) router.replace(`/campaigns/${id}/edit`);
            return;
          }
          toast.success(`${formValues.name} is published`);
          router.push("/campaigns");
          return;
        }

        toast.success(intent === "draft" ? "Draft saved" : "Changes saved");
        if (!campaign) router.replace(`/campaigns/${id}/edit`);
        else form.reset(formValues);
      } finally {
        setBusy(null);
      }
    })();

  const untilLabel = values.endDate ? `Until ${inputToDayMonth(values.endDate)}` : "";

  return (
    <FormProvider {...form}>
      <PageHeader
        title={campaign ? "Edit Campaign" : "New Campaign"}
        description="Fill in the details. Changes appear in the mobile app once published."
        actions={
          canEdit && (
            <>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => router.push("/campaigns")}
                disabled={busy !== null}
              >
                Cancel
              </Button>
              {isPublished ? (
                <Button size="lg" onClick={() => submit("save")} disabled={busy !== null}>
                  {busy === "save" ? "Saving…" : "Save changes"}
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => submit("draft")}
                    disabled={busy !== null}
                  >
                    {busy === "draft" ? "Saving…" : "Save as draft"}
                  </Button>
                  <Button size="lg" onClick={() => submit("publish")} disabled={busy !== null}>
                    <MaskIcon src="/images/icons/arrow-right.svg" size={16} />
                    {busy === "publish" ? "Publishing…" : "Publish campaign"}
                  </Button>
                </>
              )}
            </>
          )
        }
      />

      <form onSubmit={(e) => e.preventDefault()} noValidate>
        <fieldset
          disabled={!canEdit || busy !== null}
          className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_348px]"
        >
          <div className="space-y-6">
            <BasicInfoSection />
            <RewardSection />
            <ScheduleSection />
            <SectionCard
              title="Media"
              description="Offer banner, plus the prize pictures for the reward banner and the shared-link page."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <MediaDropzone
                    kind="banner"
                    label="Offer banner"
                    previewUrl={bannerUrl}
                    pending={Boolean(pending.banner)}
                    disabled={!canEdit}
                    onSelect={(file) => selectMedia("banner", file)}
                  />
                </div>
                <MediaDropzone
                  kind="reward-banner"
                  label="Reward banner image"
                  previewUrl={rewardImageUrl}
                  pending={Boolean(pending["reward-banner"])}
                  disabled={!canEdit}
                  onSelect={(file) => selectMedia("reward-banner", file)}
                />
                <MediaDropzone
                  kind="prize-tile"
                  label="Prize tile image"
                  previewUrl={prizeTileUrl}
                  pending={Boolean(pending["prize-tile"])}
                  disabled={!canEdit}
                  onSelect={(file) => selectMedia("prize-tile", file)}
                />
              </div>
            </SectionCard>
            <SharingSection />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-0">
            <LivePreview
              merchantName={values.merchantName ?? ""}
              offerTitle={values.offerTitle ?? ""}
              description={values.description ?? ""}
              untilLabel={untilLabel}
              bannerUrl={bannerUrl}
              logoUrl={campaign?.media.logoUrl ?? null}
              rewardTitle={values.rewardTitle ?? ""}
              rewardImageUrl={rewardImageUrl}
              prizeTileUrl={shownTileUrl}
            />
            <PublishingCard lifecycle={campaign?.lifecycle ?? "draft"} readiness={readiness} />
          </aside>
        </fieldset>
      </form>
    </FormProvider>
  );
}
