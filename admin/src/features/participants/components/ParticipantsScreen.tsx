"use client";

import { ExportButton } from "@/features/exports/components/ExportButton";
import { exportPath } from "@/features/exports/useDownload";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Menu } from "@/components/ui/Menu";
import { Pagination } from "@/components/ui/Pagination";
import { StatCard } from "@/components/ui/StatCard";
import { useListCampaignsQuery } from "@/features/campaigns/api/campaignsApi";
import { cn } from "@/lib/cn";
import { formatCount, formatPhone, timeAgo } from "@/lib/formatters";
import { useListParticipantsQuery } from "../api/participantsApi";
import type { ParticipantListParams } from "../types";
import { ParticipantDrawer } from "./ParticipantDrawer";
import { ParticipantStatusBadge } from "./ParticipantStatusBadge";

const PAGE_SIZE = 10;
const STATUSES: ParticipantListParams["status"][] = ["all", "active", "idle", "disqualified"];
/** Figma "Participants table" columns (238:1014); the eye column takes the rest. */
const COLUMNS: { label: string; width?: number }[] = [
  { label: "Phone number", width: 220 },
  { label: "First login", width: 170 },
  { label: "Campaigns", width: 170 },
  { label: "Shares", width: 110 },
  { label: "Opens", width: 110 },
  { label: "Last active", width: 170 },
  { label: "Status", width: 100 },
  { label: "" },
];

const icon = (name: string, size: number, className?: string) => (
  <MaskIcon src={`/images/icons/${name}.svg`} size={size} className={className} />
);

/** Toolbar dropdowns: Figma white 44px buttons, 20px padding, 16px icons. */
const toolbarSelect = "h-11 gap-2 border-line bg-white px-5";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export function ParticipantsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const search = params.get("search") ?? "";
  const campaignId = params.get("campaign") ?? "";
  const activeWithin = (
    ["7d", "30d"].includes(params.get("active") ?? "") ? params.get("active") : "all"
  ) as ParticipantListParams["activeWithin"];
  const status = (STATUSES.find((s) => s === params.get("status")) ??
    "all") as ParticipantListParams["status"];
  const page = Math.max(1, Number(params.get("page")) || 1);
  const openId = params.get("participant");

  const setParams = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === "all") merged.delete(k);
      else merged.set(k, v);
    }
    if (!("page" in next) && !("participant" in next)) merged.delete("page");
    router.replace(`${pathname}${merged.size ? `?${merged.toString()}` : ""}`, { scroll: false });
  };

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(
      () => setParams({ search: searchInput.replace(/\D/g, "") || undefined }),
      300,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams reads the latest params
  }, [searchInput]);

  const { data, isLoading, isFetching } = useListParticipantsQuery({
    search: search || undefined,
    campaignId: campaignId || undefined,
    activeWithin,
    status,
    page,
    limit: PAGE_SIZE,
  });
  const { data: campaigns } = useListCampaignsQuery({ status: "all", page: 1, limit: 100 });

  const total = data?.total ?? 0;
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        title="Participants"
        description="Every phone number that logged in and shared an offer."
        actions={
          <ExportButton
            variant="primary"
            path={exportPath("participants", { campaignId: campaignId || undefined })}
          />
        }
      />

      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <StatCard
          layout="row"
          icon={icon("kpi-users", 22)}
          label="Total participants"
          value={formatCount(data?.summary.total ?? 0)}
          changePct={data?.summary.totalChangePct}
          changeHint="New sign-ups, last 30 days vs the 30 before"
        />
        <StatCard
          layout="row"
          icon={icon("trend-up-22", 22)}
          label="New today"
          value={formatCount(data?.summary.newToday ?? 0)}
          changePct={data?.summary.newTodayChangePct}
          changeHint="vs yesterday"
        />
        <StatCard
          layout="row"
          icon={icon("kpi-share", 22)}
          label="Avg. shares per user"
          value={data?.summary.avgSharesPerUser ?? 0}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <label className="border-line flex h-11 w-[360px] items-center gap-2.5 rounded-xl border bg-white px-4 text-[#8e8589] focus-within:border-[#e2136e] focus-within:shadow-[0_0_0_3px_#fce7f0]">
          {icon("search", 18)}
          <span className="sr-only">Search by phone number</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            inputMode="numeric"
            placeholder="Search by phone number"
            className="text-ink placeholder:text-subtle w-full bg-transparent text-[13px] leading-[normal] outline-none"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="block">
            <span className="sr-only">Campaign</span>
            <Select
              value={campaignId}
              onChange={(e) => setParams({ campaign: e.target.value || undefined })}
              leading={icon("nav-mega", 16, "text-ink")}
              boxClassName={cn(toolbarSelect, "w-[196px]")}
              className="text-sm font-semibold"
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
          </label>
          <label className="block">
            <span className="sr-only">Active within</span>
            <Select
              value={activeWithin}
              onChange={(e) => setParams({ active: e.target.value })}
              leading={icon("btn-cal", 16, "text-ink")}
              boxClassName={cn(toolbarSelect, "w-[177px]")}
              className="text-sm font-semibold"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </Select>
          </label>
          <Menu
            label="Filter by status"
            triggerClassName={cn(
              "border-line text-ink inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-5 text-sm leading-[normal] font-semibold hover:bg-zinc-50",
              status !== "all" && "border-[#e2136e] text-[#e2136e]",
            )}
            trigger={
              <>
                {icon("filter", 16)}
                {status === "all" ? "Filters" : status[0]!.toUpperCase() + status.slice(1)}
              </>
            }
            items={STATUSES.map((s) => ({
              label: s === "all" ? "All statuses" : s[0]!.toUpperCase() + s.slice(1),
              onSelect: () => setParams({ status: s }),
            }))}
          />
        </div>
      </div>

      <Card className="overflow-clip">
        <div className="overflow-x-auto">
          <table
            className={cn(
              "w-full min-w-[1090px] table-fixed text-left leading-[normal]",
              isFetching && !isLoading && "opacity-70",
            )}
          >
            <colgroup>
              {COLUMNS.map((col, i) => (
                <col key={i} style={col.width ? { width: col.width } : undefined} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-canvas border-line h-11 border-b">
                {COLUMNS.map((col, i) => (
                  <th key={i} className="text-subtle px-5 text-[11px] font-bold uppercase">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-line h-15 border-b">
                    <td colSpan={8} className="px-5">
                      <div className="h-6 animate-pulse rounded bg-zinc-100" />
                    </td>
                  </tr>
                ))}
              {data?.items.length === 0 && (
                <tr className="border-line border-b">
                  <td colSpan={8} className="text-muted px-6 py-12 text-center text-sm">
                    No participants match these filters.
                  </td>
                </tr>
              )}
              {data?.items.map((p) => (
                <tr
                  key={p.id}
                  className="border-line h-15 border-b text-[13px] font-medium text-[#5d5358]"
                >
                  <td className="text-ink px-5 text-sm font-semibold">
                    <span className="inline-flex items-center gap-2 whitespace-nowrap">
                      {icon("phone-14", 14, "text-subtle")}
                      {formatPhone(p.phone)}
                      {p.flagged && (
                        <Flag className="size-3.5 text-amber-500" aria-label="Has a flagged link" />
                      )}
                    </span>
                  </td>
                  <td className="px-5 whitespace-nowrap">
                    {dateFmt.format(new Date(p.firstLoginAt)).replace("Sept", "Sep")}
                  </td>
                  <td className="px-5">
                    <CampaignPills names={p.campaigns.map((c) => c.name)} />
                  </td>
                  <td className="text-ink px-5 text-sm font-bold tabular-nums">
                    {formatCount(p.shares)}
                  </td>
                  <td className="px-5 text-sm tabular-nums">{formatCount(p.opens)}</td>
                  <td className="px-5 whitespace-nowrap">{timeAgo(p.lastActiveAt)}</td>
                  <td className="px-5">
                    <ParticipantStatusBadge status={p.status} />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setParams({ participant: p.id })}
                      aria-label={`View ${formatPhone(p.phone)}`}
                      className="border-line text-muted hover:text-ink mx-auto grid size-8 place-items-center rounded-lg border bg-white hover:bg-zinc-50"
                    >
                      {icon("eye-16", 16)}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-5 leading-[normal]">
          <p className="text-subtle text-[13px] font-medium">
            Showing {formatCount(first)}–{formatCount(last)} of {formatCount(total)} participants
          </p>
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
            onChange={(p) => setParams({ page: String(p) })}
          />
        </div>
      </Card>

      {openId && (
        <ParticipantDrawer
          key={openId}
          id={openId}
          onClose={() => setParams({ participant: undefined })}
        />
      )}
    </>
  );
}

/**
 * Figma "Campaigns" cell: one line of 12px pills (first pink, others grey). Pills
 * that don't fit the 130px cell collapse into a "+N" pill; all names are in the tooltip.
 */
function CampaignPills({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-subtle">—</span>;
  const BUDGET = 130;
  const pill = (name: string) => 20 + name.length * 7;
  const shown: string[] = [];
  let used = 0;
  for (const [i, name] of names.entries()) {
    const rest = names.length - i - 1;
    const need = (shown.length ? 6 : 0) + pill(name) + (rest ? 40 : 0);
    if (shown.length && used + need > BUDGET) break;
    shown.push(name);
    used += (shown.length > 1 ? 6 : 0) + pill(name);
  }
  const hidden = names.length - shown.length;
  return (
    <span className="flex gap-1.5" title={names.join(", ")}>
      {shown.map((name, i) => (
        <span
          key={name}
          className={cn(
            "rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap",
            i === 0 ? "bg-[#fce7f0] text-[#e2136e]" : "bg-[#f1eef0] text-[#5d5358]",
          )}
        >
          {name}
        </span>
      ))}
      {hidden > 0 && (
        <span className="rounded-full bg-[#f1eef0] px-2 py-[3px] text-xs font-semibold text-[#5d5358]">
          +{hidden}
        </span>
      )}
    </span>
  );
}
