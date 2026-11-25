"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { useListCampaignsQuery } from "@/features/campaigns/api/campaignsApi";
import { cn } from "@/lib/cn";
import { endInputToIso, startInputToIso, todayInput } from "@/lib/dates";
import { formatCount } from "@/lib/formatters";
import { useGetExportSummaryQuery, type ExportSummary, type ExportType } from "../api/exportsApi";
import { useDownload } from "../useDownload";

const icon = (name: string, size: number, className?: string) => (
  <MaskIcon src={`/images/icons/${name}.svg`} size={size} className={className} />
);

/** Figma "Data to include" options (2 × 2). Each ticked dataset becomes a sheet. */
const DATASETS: {
  value: ExportType;
  label: string;
  /** Rows for the "≈ N rows" estimate (null = not countable up front). */
  rows: (s: ExportSummary) => number | null;
  /** Whether the date range applies to this dataset. */
  dated: boolean;
}[] = [
  { value: "participants", label: "Participants", rows: (s) => s.participants, dated: true },
  { value: "share-activity", label: "Share activity", rows: (s) => s.shareActivity, dated: true },
  { value: "link-opens", label: "Link opens", rows: (s) => s.linkOpens, dated: true },
  { value: "leaderboard", label: "Leaderboard", rows: () => null, dated: false },
];

/** Figma "Columns" chips → Participants sheet columns (API keys), in sheet order. */
const COLUMNS = [
  { key: "phone", label: "Phone number" },
  { key: "first", label: "First login" },
  { key: "campaigns", label: "Campaigns" },
  { key: "shares", label: "Shares" },
  { key: "opens", label: "Link opens" },
  { key: "last", label: "Last active" },
  { key: "status", label: "Status" },
] as const;
type ColumnKey = (typeof COLUMNS)[number]["key"];

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
/** "2026-10-01" → local date (date inputs are plain calendar days). */
const asDate = (value: string) => new Date(`${value}T00:00:00`);
const fmt = (f: Intl.DateTimeFormat, value: string) =>
  f.format(asDate(value)).replace("Sept", "Sep");

/** "1 Oct – 5 Nov 2026", "Since 1 Oct 2026", "Until 5 Nov 2026" or "All time". */
function rangeLabel(from: string, to: string): string {
  if (from && to) {
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${fmt(sameYear ? dayMonth : dayMonthYear, from)} – ${fmt(dayMonthYear, to)}`;
  }
  if (from) return `Since ${fmt(dayMonthYear, from)}`;
  if (to) return `Until ${fmt(dayMonthYear, to)}`;
  return "All time";
}

/**
 * Figma "Export modal" (239:1244): pick datasets (one sheet each), a campaign, a
 * date range (Bangladesh days) and the Participants columns, then download a
 * single .xlsx.
 */
export function CustomExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const ids = { title: useId(), campaign: useId() };
  const { data: campaigns } = useListCampaignsQuery({ status: "all", page: 1, limit: 100 });
  const { data: summary } = useGetExportSummaryQuery();
  const { download, busy } = useDownload();

  const [datasets, setDatasets] = useState<ExportType[]>([
    "participants",
    "share-activity",
    "leaderboard",
  ]);
  const [columns, setColumns] = useState<ColumnKey[]>(COLUMNS.map((c) => c.key));
  const [campaignId, setCampaignId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const picked = DATASETS.filter((d) => datasets.includes(d.value));
  const withParticipants = datasets.includes("participants");
  const invalidRange = Boolean(from && to && to < from);
  const canDownload =
    picked.length > 0 && (!withParticipants || columns.length > 0) && !invalidRange;

  const rowCounts = summary ? picked.map((d) => d.rows(summary)) : [];
  const knownRows = rowCounts.filter((n): n is number => n !== null);
  const estimate = !summary
    ? "…"
    : knownRows.length
      ? `≈ ${formatCount(knownRows.reduce((a, b) => a + b, 0))} rows`
      : picked.length
        ? `${summary.leaderboards} leaderboard sheet${summary.leaderboards === 1 ? "" : "s"}`
        : "Nothing selected";

  const submit = async () => {
    const query = new URLSearchParams({
      datasets: DATASETS.filter((d) => datasets.includes(d.value))
        .map((d) => d.value)
        .join(","),
    });
    if (withParticipants && columns.length < COLUMNS.length)
      query.set(
        "columns",
        COLUMNS.filter((c) => columns.includes(c.key))
          .map((c) => c.key)
          .join(","),
      );
    if (campaignId) query.set("campaignId", campaignId);
    if (from) query.set("from", startInputToIso(from));
    if (to) query.set("to", endInputToIso(to));
    await download(`/admin/exports/custom?${query.toString()}`, "custom");
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby={ids.title}
      className="m-auto w-[calc(100%-2rem)] max-w-[560px] overflow-visible rounded-[20px] bg-white p-0 shadow-[0_16px_24px_rgb(74_25_48/0.3)]"
    >
      {open && (
        <form
          className="flex flex-col gap-5 p-7 leading-[normal]"
          onSubmit={(e) => {
            e.preventDefault();
            if (canDownload) void submit();
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#fce7f0] text-[#e2136e]">
                {icon("sheet", 24)}
              </span>
              <div className="flex flex-col gap-0.5">
                <h2 id={ids.title} className="text-ink text-xl font-extrabold">
                  Export to Excel
                </h2>
                <p className="text-subtle text-[13px]">
                  Download participant and share data as .xlsx
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => ref.current?.close()}
              className="text-muted hover:text-ink grid size-9 shrink-0 place-items-center rounded-full bg-[#f7f5f6] transition-colors hover:bg-[#eae3e6]"
            >
              {icon("close-18", 18)}
            </button>
          </div>

          {/* Data to include */}
          <fieldset className="flex flex-col gap-2.5">
            <legend className="text-ink mb-2.5 text-[13px] font-semibold">Data to include</legend>
            <div className="grid grid-cols-2 gap-3">
              {DATASETS.map((d) => {
                const on = datasets.includes(d.value);
                return (
                  <label
                    key={d.value}
                    className={cn(
                      "flex h-[52px] cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 text-[13px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#e2136e]/40",
                      on
                        ? "border-[#e2136e] bg-[#fce7f0] text-[#b70d57]"
                        : "border-line text-muted bg-white hover:bg-[#f7f5f6]",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => setDatasets((list) => toggle(list, d.value))}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md",
                        on ? "bg-[#e2136e] text-white" : "border-line border bg-white",
                      )}
                    >
                      {on && icon("check-12", 12)}
                    </span>
                    {d.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor={ids.campaign} className="text-ink text-[13px] font-semibold">
                Campaign
              </label>
              <Select
                id={ids.campaign}
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                leading={icon("nav-mega", 18)}
              >
                <option value="">All campaigns</option>
                {(campaigns?.items ?? [])
                  .filter((c) => c.status === "published")
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.merchantName} offer
                    </option>
                  ))}
              </Select>
            </div>
            <DateRangeField
              from={from}
              to={to}
              invalid={invalidRange}
              disabled={!picked.some((d) => d.dated)}
              onChange={(next) => {
                setFrom(next.from);
                setTo(next.to);
              }}
            />
          </div>

          {/* Columns (Participants sheet) */}
          {withParticipants && (
            <fieldset className="flex flex-col">
              <legend className="text-ink mb-2.5 text-[13px] font-semibold">Columns</legend>
              <div className="flex flex-wrap gap-2">
                {COLUMNS.map((c) => {
                  const on = columns.includes(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setColumns((list) => toggle(list, c.key))}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                        on
                          ? "border-[#e2136e] bg-[#e2136e] text-white"
                          : "border-line text-muted bg-white hover:bg-[#f7f5f6]",
                      )}
                    >
                      {on && icon("check-12", 12)}
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {columns.length === 0 && (
                <p role="alert" className="mt-2 text-xs text-red-600">
                  Pick at least one column.
                </p>
              )}
            </fieldset>
          )}

          {/* Footer */}
          <div className="border-line flex items-center justify-between gap-4 border-t pt-5">
            <p className="text-subtle flex items-center gap-2 text-[13px] font-medium">
              {icon("sheet", 16)}
              {estimate} · .xlsx
            </p>
            <div className="flex gap-3">
              <Button size="lg" variant="secondary" onClick={() => ref.current?.close()}>
                Cancel
              </Button>
              <Button size="lg" type="submit" disabled={busy !== null || !canDownload}>
                {icon("btn-dl", 16)} {busy ? "Preparing…" : "Download Excel"}
              </Button>
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}

/**
 * Figma "Date range" field: shows "1 Oct – 5 Nov 2026"; clicking opens a small
 * panel with quick ranges and From / To pickers (Bangladesh calendar days).
 */
function DateRangeField({
  from,
  to,
  invalid,
  disabled,
  onChange,
}: {
  from: string;
  to: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const ids = { label: useId(), from: useId(), to: useId() };

  // Close on outside click / Escape (Escape is stopped so the dialog stays open).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const presets = [
    { label: "Last 7 days", from: todayInput(-6), to: todayInput() },
    { label: "Last 30 days", from: todayInput(-29), to: todayInput() },
    { label: "All time", from: "", to: "" },
  ];

  return (
    <div ref={boxRef} className="relative flex flex-col gap-2">
      <span id={ids.label} className="text-ink text-[13px] font-semibold">
        Date range
      </span>
      <button
        type="button"
        aria-labelledby={ids.label}
        aria-expanded={open}
        disabled={disabled}
        title={disabled ? "Leaderboards cover the whole campaign" : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "text-ink flex h-12 w-full items-center gap-2.5 rounded-xl border bg-[#f7f5f6] px-3.5 text-left text-sm font-medium transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-60",
          open
            ? "border-[#e2136e] bg-white shadow-[0_0_0_3px_#fce7f0]"
            : invalid
              ? "border-red-400"
              : "border-line",
        )}
      >
        {icon("calendar", 18, "text-subtle")}
        <span className="truncate">{disabled ? "Whole campaign" : rangeLabel(from, to)}</span>
      </button>
      {invalid && (
        <p role="alert" className="text-xs text-red-600">
          End date must be after the start date.
        </p>
      )}

      {open && (
        <div className="border-line shadow-card absolute top-full right-0 z-10 mt-2 flex w-[280px] flex-col gap-3 rounded-2xl border bg-white p-4">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const active = p.from === from && p.to === to;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    onChange({ from: p.from, to: p.to });
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-[#e2136e] bg-[#fce7f0] text-[#e2136e]"
                      : "border-line text-muted hover:bg-[#f7f5f6]",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: ids.from,
                  label: "From",
                  value: from,
                  set: (v: string) => onChange({ from: v, to }),
                },
                {
                  id: ids.to,
                  label: "To",
                  value: to,
                  set: (v: string) => onChange({ from, to: v }),
                },
              ] as const
            ).map((f) => (
              <label key={f.label} htmlFor={f.id} className="flex flex-col gap-1">
                <span className="text-subtle text-[11px] font-semibold uppercase">{f.label}</span>
                <input
                  id={f.id}
                  type="date"
                  value={f.value}
                  max={todayInput()}
                  onChange={(e) => f.set(e.target.value)}
                  className="border-line text-ink relative h-9 rounded-lg border bg-[#f7f5f6] px-2 text-xs font-medium outline-none focus:border-[#e2136e]"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
