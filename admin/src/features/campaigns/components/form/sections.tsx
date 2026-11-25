"use client";

import { useId } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { SectionCard } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Toggle } from "@/components/ui/Toggle";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { autoValidityLabel, type CampaignFormValues } from "../../lib/campaignForm";

const useForm = () => useFormContext<CampaignFormValues>();

/** Figma field rows: 16px between columns, 20px between rows. */
const fieldGrid = "grid gap-x-4 gap-y-5";

export function BasicInfoSection() {
  const {
    register,
    formState: { errors },
  } = useForm();
  const id = useId();
  return (
    <SectionCard title="Basic information" description="Shown on the offer card in the mobile app.">
      <div className={cn(fieldGrid, "sm:grid-cols-2")}>
        <Field label="Campaign name" required htmlFor={`${id}-name`} error={errors.name?.message}>
          <Input
            id={`${id}-name`}
            placeholder="Foodi Food Fest"
            aria-invalid={Boolean(errors.name)}
            {...register("name")}
          />
        </Field>
        <Field
          label="Merchant name"
          required
          htmlFor={`${id}-merchant`}
          error={errors.merchantName?.message}
        >
          <Input
            id={`${id}-merchant`}
            placeholder="Foodi"
            aria-invalid={Boolean(errors.merchantName)}
            {...register("merchantName")}
          />
        </Field>
        <Field
          label="Offer title"
          required
          htmlFor={`${id}-title`}
          error={errors.offerTitle?.message}
          className="sm:col-span-2"
        >
          <Input
            id={`${id}-title`}
            placeholder="Offer on Favorite Food Orders!"
            aria-invalid={Boolean(errors.offerTitle)}
            {...register("offerTitle")}
          />
        </Field>
        <Field
          label="Offer description"
          htmlFor={`${id}-desc`}
          hint="Up to 3 lines are shown on the offer card."
          error={errors.description?.message}
          className="sm:col-span-2"
        >
          <Textarea
            id={`${id}-desc`}
            rows={3}
            placeholder="Get BDT 100 discount on a BDT 399 order…"
            {...register("description")}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

export function RewardSection() {
  const {
    register,
    control,
    formState: { errors },
  } = useForm();
  const id = useId();
  return (
    <SectionCard title="Reward & winners" description="Who wins and how the leaderboard is ranked.">
      <div className={cn(fieldGrid, "sm:grid-cols-2")}>
        <Field
          label="Reward title"
          required
          htmlFor={`${id}-reward`}
          error={errors.rewardTitle?.message}
        >
          <Input
            id={`${id}-reward`}
            placeholder="Win an iPhone 17 Pro"
            aria-invalid={Boolean(errors.rewardTitle)}
            {...register("rewardTitle")}
          />
        </Field>
        <Field label="Winner selection" htmlFor={`${id}-selection`}>
          <Select id={`${id}-selection`} defaultValue="top_sharer">
            <option value="top_sharer">Top sharer (Rank #1)</option>
          </Select>
        </Field>
        <Field
          label="Number of winners"
          htmlFor={`${id}-winners`}
          error={errors.numberOfWinners?.message}
        >
          <Input
            id={`${id}-winners`}
            type="number"
            min={1}
            max={100}
            {...register("numberOfWinners", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Ranking basis" htmlFor={`${id}-basis`}>
          <Controller
            control={control}
            name="rankingBasis"
            render={({ field }) => (
              <Select
                id={`${id}-basis`}
                name={field.name}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
              >
                <option value="opens">Total link opens</option>
                <option value="shares">Total link shares</option>
              </Select>
            )}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

export function ScheduleSection() {
  const {
    register,
    control,
    formState: { errors },
  } = useForm();
  const endDate = useWatch({ control, name: "endDate" });
  const id = useId();
  const calendar = <MaskIcon src="/images/icons/calendar.svg" size={18} />;
  return (
    <SectionCard title="Schedule" description="Set when the campaign goes live and ends.">
      <div className={cn(fieldGrid, "sm:grid-cols-3")}>
        <Field
          label="Start date"
          required
          htmlFor={`${id}-start`}
          error={errors.startDate?.message}
        >
          <Input
            id={`${id}-start`}
            type="date"
            leading={calendar}
            aria-invalid={Boolean(errors.startDate)}
            {...register("startDate")}
          />
        </Field>
        <Field label="End date" required htmlFor={`${id}-end`} error={errors.endDate?.message}>
          <Input
            id={`${id}-end`}
            type="date"
            leading={calendar}
            aria-invalid={Boolean(errors.endDate)}
            {...register("endDate")}
          />
        </Field>
        <Field label="Validity label" htmlFor={`${id}-label`} error={errors.validityLabel?.message}>
          <Input
            id={`${id}-label`}
            placeholder={autoValidityLabel(endDate) || "Valid until 30 Nov"}
            {...register("validityLabel")}
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    // Figma "Setting / …": 14px semibold title, 12px grey note, rule 16px below.
    <div className="border-line flex items-center justify-between gap-6 border-b pb-4">
      <div className="flex flex-col gap-0.5 leading-[normal]">
        <p className="text-ink text-sm font-semibold">{title}</p>
        <p className="text-subtle text-xs">{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Figma "Section / Sharing settings". The anti-abuse limits (links per device,
 * opens per network/hour, opens per 10 min) aren't in the design, so they have no
 * fields: new campaigns get the API defaults and edits keep the saved values.
 */
export function SharingSection() {
  const { control } = useForm();
  const id = useId();
  const site = env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "");
  const toggles = [
    {
      name: "requirePhone",
      title: "Require phone verification",
      description: "Users enter only their mobile number to get a link — no OTP.",
    },
    {
      name: "showOnHome",
      title: "Show on home page",
      description: "Display this campaign in the live offers list.",
    },
    {
      name: "countLinkOpens",
      title: "Count link opens",
      description: "Include friends opening the link in leaderboard ranking.",
    },
  ] as const;

  return (
    <SectionCard
      title="Sharing settings"
      description="Control how people join and share this campaign."
    >
      <div className="flex flex-col gap-5">
        {toggles.map((t) => (
          <SettingRow key={t.name} title={t.title} description={t.description}>
            <Controller
              control={control}
              name={t.name}
              render={({ field }) => (
                <Toggle checked={field.value} onChange={field.onChange} label={t.title} />
              )}
            />
          </SettingRow>
        ))}

        <Field
          label="Share link format"
          htmlFor={`${id}-format`}
          hint="Each participant gets a unique personal link."
        >
          <Input
            id={`${id}-format`}
            readOnly
            value={`${site}/s/{code}`}
            leading={<MaskIcon src="/images/icons/link.svg" size={18} />}
          />
        </Field>
      </div>
    </SectionCard>
  );
}
