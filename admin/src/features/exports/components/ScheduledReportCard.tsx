"use client";

import { Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, PanelTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useSaveReportScheduleMutation,
  useSendReportNowMutation,
  type ReportDataset,
  type ReportFrequency,
  type ReportSchedule,
} from "../api/exportsApi";

const DATASET_OPTIONS: { value: string; label: string; datasets: ReportDataset[] }[] = [
  {
    value: "participants+leaderboard",
    label: "Participants + Leaderboard",
    datasets: ["participants", "leaderboard"],
  },
  { value: "participants", label: "Participants", datasets: ["participants"] },
  { value: "leaderboard", label: "Leaderboard", datasets: ["leaderboard"] },
  {
    value: "all",
    label: "Everything",
    datasets: ["participants", "leaderboard", "share-activity", "link-opens"],
  },
];
const FREQUENCIES: { value: ReportFrequency; label: string }[] = [
  { value: "daily", label: "Every day, 9:00 AM" },
  { value: "weekly", label: "Every Monday, 9:00 AM" },
  { value: "monthly", label: "1st of every month, 9:00 AM" },
];
const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Dhaka",
});

const icon = (name: string) => <MaskIcon src={`/images/icons/${name}.svg`} size={18} />;

/** "Scheduled report" card: email an Excel report automatically (times in Bangladesh). */
export function ScheduledReportCard({
  schedule,
  canEdit,
}: {
  schedule: ReportSchedule;
  canEdit: boolean;
}) {
  const toast = useToast();
  const ids = { frequency: useId(), data: useId(), to: useId() };
  const [save, { isLoading: saving }] = useSaveReportScheduleMutation();
  const [sendNow, { isLoading: sending }] = useSendReportNowMutation();
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [frequency, setFrequency] = useState(schedule.frequency);
  const [dataKey, setDataKey] = useState(
    DATASET_OPTIONS.find((o) => o.datasets.join() === schedule.datasets.join())?.value ??
      "participants+leaderboard",
  );
  const [recipients, setRecipients] = useState(schedule.recipients.join(", "));

  const emails = recipients.split(/[\s,;]+/).filter(Boolean);
  const invalid = emails.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  const onSave = async () => {
    const datasets = DATASET_OPTIONS.find((o) => o.value === dataKey)!.datasets;
    const result = await save({ enabled, frequency, datasets, recipients: emails });
    if ("error" in result) toast.error(getApiErrorMessage(result.error));
    else toast.success(result.data.enabled ? "Schedule saved" : "Scheduled report turned off");
  };

  return (
    // Figma "Scheduled report" (239:819): 24px padding, 20px gaps, 48px fields.
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <PanelTitle title="Scheduled report" description="Email an Excel report automatically" />
        <Toggle
          checked={enabled}
          onChange={setEnabled}
          label="Enable scheduled report"
          disabled={!canEdit}
        />
      </div>

      <div className="flex flex-col gap-5">
        <Field label="Frequency" htmlFor={ids.frequency}>
          <div>
            <Select
              id={ids.frequency}
              value={frequency}
              disabled={!canEdit}
              onChange={(e) => setFrequency(e.target.value as ReportFrequency)}
              leading={icon("clock")}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label="Data to include" htmlFor={ids.data}>
          <div>
            <Select
              id={ids.data}
              value={dataKey}
              disabled={!canEdit}
              onChange={(e) => setDataKey(e.target.value)}
              leading={icon("sheet")}
            >
              {DATASET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field
          label="Send to"
          htmlFor={ids.to}
          error={invalid.length ? `Not an email: ${invalid.join(", ")}` : undefined}
        >
          <Input
            id={ids.to}
            value={recipients}
            disabled={!canEdit}
            onChange={(e) => setRecipients(e.target.value)}
            leading={icon("mail")}
            placeholder="admin@mnemonic.com"
            title="Separate several addresses with commas"
          />
        </Field>

        {canEdit && (
          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={onSave}
            disabled={saving || invalid.length > 0}
          >
            {saving ? "Saving…" : "Save schedule"}
          </Button>
        )}

        <div className="text-muted -mt-1 space-y-1 text-[11px] empty:hidden">
          {schedule.enabled && schedule.nextRunAt && (
            <p>Next report: {when.format(new Date(schedule.nextRunAt))}</p>
          )}
          {schedule.lastRunAt && (
            <p className={schedule.lastStatus === "failed" ? "text-red-600" : undefined}>
              Last report: {when.format(new Date(schedule.lastRunAt))} ·{" "}
              {schedule.lastStatus === "failed"
                ? `failed (${schedule.lastError ?? "error"})`
                : "sent"}
            </p>
          )}
          {schedule.delivery === "outbox" && (
            <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">
              Development mode: no email provider is set, so reports are saved to the API&apos;s
              outbox folder.
            </p>
          )}
          {canEdit && schedule.recipients.length > 0 && (
            <button
              type="button"
              disabled={sending}
              onClick={async () => {
                const result = await sendNow();
                if ("error" in result) toast.error(getApiErrorMessage(result.error));
                else
                  toast.success(
                    schedule.delivery === "outbox" ? "Report written to the outbox" : "Report sent",
                  );
              }}
              className="text-brand-500 inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-50"
            >
              <Send className="size-3" /> {sending ? "Sending…" : "Send a report now"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
