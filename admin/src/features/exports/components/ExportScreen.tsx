"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, PanelTitle } from "@/components/ui/Card";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Spinner } from "@/components/ui/Spinner";
import { useMeQuery } from "@/features/auth/api/authApi";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime } from "@/lib/formatters";
import {
  useGetExportHistoryQuery,
  useGetExportSummaryQuery,
  useGetReportScheduleQuery,
  type ExportSummary,
  type ExportType,
} from "../api/exportsApi";
import { exportPath, useDownload } from "../useDownload";
import { CustomExportDialog } from "./CustomExportDialog";
import { ScheduledReportCard } from "./ScheduledReportCard";

const CARDS: {
  type: ExportType;
  title: string;
  description: string;
  /** Figma 22px icon in /images/icons. */
  icon: string;
  count: (s: ExportSummary) => string;
}[] = [
  {
    type: "participants",
    title: "Participants",
    description: "Phone numbers, first login, shares and link opens.",
    icon: "kpi-users",
    count: (s) => `${formatCount(s.participants)} rows`,
  },
  {
    type: "share-activity",
    title: "Share activity",
    description: "Every link share with campaign and timestamp.",
    icon: "kpi-share",
    count: (s) => `${formatCount(s.shareActivity)} rows`,
  },
  {
    type: "link-opens",
    title: "Link opens",
    description: "Friends who opened a shared link.",
    icon: "kpi-eye",
    count: (s) => `${formatCount(s.linkOpens)} rows`,
  },
  {
    type: "leaderboard",
    title: "Leaderboard",
    description: "Ranked top sharers for each campaign.",
    icon: "kpi-trophy",
    count: (s) => `${s.leaderboards} campaign${s.leaderboards === 1 ? "" : "s"}`,
  },
];

const icon = (name: string, size: number, className?: string) => (
  <MaskIcon src={`/images/icons/${name}.svg`} size={size} className={className} />
);

/** Figma "Export history" columns (239:688); the download column takes the rest. */
const HISTORY_COLUMNS: { label: string; width?: number }[] = [
  { label: "File", width: 290 },
  { label: "By", width: 120 },
  { label: "Date", width: 150 },
  { label: "Rows", width: 96 },
  { label: "" },
];

export function ExportScreen() {
  const { data: me } = useMeQuery();
  const canExport = me?.role === "admin";
  const { data: summary } = useGetExportSummaryQuery();
  const { data: history } = useGetExportHistoryQuery();
  const { data: schedule } = useGetReportScheduleQuery();
  const { download, busy } = useDownload();
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Export Data"
        description="Download campaign data as Excel (.xlsx) files."
        actions={
          canExport && (
            <Button size="lg" onClick={() => setCustomOpen(true)}>
              {icon("sheet", 16)} Custom export
            </Button>
          )
        }
      />
      {!canExport && me && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Exports contain personal data, so only admins can download them.
        </p>
      )}

      {/* Figma "Dataset / …" (239:582): 20px padding, 16px gaps, 44px icon tile, full-width Download. */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map(({ type, title, description, icon: name, count }) => (
          <Card key={type} className="flex flex-col items-start gap-4 p-5 leading-[normal]">
            <span className="grid size-11 place-items-center rounded-xl bg-[#fce7f0] text-[#e2136e]">
              {icon(name, 22)}
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <h2 className="text-ink text-base font-bold">{title}</h2>
              <p className="text-muted text-[13px] leading-[19px]">{description}</p>
            </div>
            <p className="text-subtle flex items-center gap-1.5 text-xs font-medium">
              {icon("sheet", 14)}
              {summary ? count(summary) : "…"} · .xlsx
            </p>
            <Button
              variant="outline"
              size="lg"
              fullWidth
              disabled={!canExport || busy !== null}
              onClick={() => void download(exportPath(type), type)}
            >
              {icon("btn-dl", 16)} {busy === type ? "Preparing…" : "Download"}
            </Button>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
        <Card className="overflow-clip">
          <div className="px-6 pt-6 pb-4">
            <PanelTitle title="Export history" description="Files downloaded by admins" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] table-fixed text-left leading-[normal]">
              <colgroup>
                {HISTORY_COLUMNS.map((col, i) => (
                  <col key={i} style={col.width ? { width: col.width } : undefined} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-canvas border-line h-11 border-b">
                  {HISTORY_COLUMNS.map((col, i) => (
                    <th key={i} className="text-subtle px-5 text-[11px] font-bold uppercase">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!history && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center">
                      <Spinner />
                    </td>
                  </tr>
                )}
                {history?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted px-6 py-10 text-center text-sm">
                      No exports yet.
                    </td>
                  </tr>
                )}
                {history?.map((h) => (
                  <tr
                    key={h.id}
                    className="border-line h-15 border-b text-[13px] font-medium text-[#5d5358] last:border-b-0"
                  >
                    <td className="px-5">
                      <span className="text-ink flex min-w-0 items-center gap-2.5 font-semibold">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#fce7f0] text-[#e2136e]">
                          {icon("sheet", 16)}
                        </span>
                        <span className="truncate" title={h.filename}>
                          {h.filename}
                        </span>
                      </span>
                    </td>
                    <td className="truncate px-5">
                      {h.source === "scheduled" ? "Scheduled" : h.adminName}
                    </td>
                    <td className="px-5 whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                    <td className="text-ink px-5 font-bold tabular-nums">{formatCount(h.rows)}</td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Download ${h.filename} again`}
                        title="Re-downloads use the latest data"
                        disabled={!canExport || busy !== null}
                        onClick={() =>
                          void download(`/admin/exports/history/${h.id}/download`, h.id)
                        }
                        className={cn(
                          "border-line text-muted hover:text-ink mx-auto grid size-8 place-items-center rounded-lg border bg-white hover:bg-zinc-50 disabled:opacity-40",
                        )}
                      >
                        {icon("btn-dl", 16)}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {schedule ? (
          <ScheduledReportCard
            key={schedule.nextRunAt ?? "off"}
            schedule={schedule}
            canEdit={canExport}
          />
        ) : (
          <Card className="grid place-items-center p-10">
            <Spinner />
          </Card>
        )}
      </div>

      <CustomExportDialog open={customOpen} onClose={() => setCustomOpen(false)} />
    </>
  );
}
