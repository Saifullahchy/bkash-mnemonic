"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, PanelTitle } from "@/components/ui/Card";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Select } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { MerchantTile } from "@/features/campaigns/components/MerchantTile";
import { StatusBadge } from "@/features/campaigns/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { endDayLabel } from "@/lib/dates";
import { formatCount, formatPhone } from "@/lib/formatters";
import { useGetDashboardQuery } from "../api/dashboardApi";
import type { ChartRange, KpiRange } from "../types";
import { ActivityFeed } from "./ActivityFeed";
import { RankBadge } from "./RankBadge";
import { SERIES_COLORS, SharesChart } from "./SharesChart";

const CHART_RANGES: { value: ChartRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
];

const icon = (name: string, size: number) => (
  <Image
    src={`/images/icons/${name}.svg`}
    alt=""
    aria-hidden
    width={size}
    height={size}
    unoptimized
  />
);

/** Figma pink text link with a 14px arrow ("View all →"). */
function PanelLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-brand-500 inline-flex items-center gap-1 text-[13px] leading-[normal] font-semibold whitespace-nowrap hover:underline"
    >
      {children} {icon("arrow-right", 14)}
    </Link>
  );
}

/** Dashboard — Figma "Admin / 02 Dashboard" (node 236:477). */
export function DashboardScreen() {
  const [range, setRange] = useState<KpiRange>("7d");
  const [chart, setChart] = useState<ChartRange>("7d");
  // Figma shows the top 2 live campaigns; "View all" expands the list in place.
  const [allLive, setAllLive] = useState(false);
  const { data, isLoading, error, isFetching } = useGetDashboardQuery({ range, chart });
  const periodCaption = range === "7d" ? "vs previous 7 days" : "vs previous 30 days";

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your share campaigns, users and top sharers."
        actions={
          <>
            <label className="block">
              <span className="sr-only">Period</span>
              <Select
                value={range}
                onChange={(e) => setRange(e.target.value as KpiRange)}
                leading={icon("btn-cal", 16)}
                boxClassName="h-11 w-[172px] gap-2 bg-white px-5"
                className="text-sm font-semibold"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </Select>
            </label>
            <Link
              href="/export"
              className="border-brand-500 text-brand-500 hover:bg-brand-50 inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold"
            >
              {icon("btn-dl", 16)} Export Excel
            </Link>
            <Link
              href="/campaigns/new"
              className="bg-brand-500 hover:bg-brand-600 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white drop-shadow-[0_4px_6px_rgb(74_25_48/0.18)]"
            >
              {icon("btn-plus", 16)} New Campaign
            </Link>
          </>
        }
      />

      {isLoading && (
        <div className="grid place-items-center py-24">
          <Spinner className="size-7" label="Loading dashboard" />
        </div>
      )}
      {error && !data && <p className="text-sm text-red-600">{getApiErrorMessage(error)}</p>}

      {data && (
        <div className={cn("space-y-6 transition-opacity", isFetching && "opacity-70")}>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<MaskIcon src="/images/icons/kpi-mega.svg" size={22} />}
              label="Live campaigns"
              value={data.kpis.liveCampaigns.value}
              caption={`of ${data.kpis.liveCampaigns.total} total campaigns`}
              badge={
                data.kpis.liveCampaigns.value > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(226_19_110/0.3)] bg-white px-2.5 py-1 text-xs leading-[normal] font-bold text-[#e2136e]">
                    <span className="size-1.5 rounded-full bg-[#e2136e]" /> Live now
                  </span>
                ) : undefined
              }
            />
            <StatCard
              icon={<MaskIcon src="/images/icons/kpi-users.svg" size={22} />}
              label="Logged-in users"
              value={formatCount(data.kpis.participants.value)}
              caption="Verified phone numbers"
              changeHint={periodCaption}
              changePct={data.kpis.participants.changePct}
            />
            <StatCard
              icon={<MaskIcon src="/images/icons/kpi-share.svg" size={22} />}
              label="Total link shares"
              value={formatCount(data.kpis.shares.value)}
              caption="Across all campaigns"
              changePct={data.kpis.shares.changePct}
              changeHint={periodCaption}
            />
            <StatCard
              icon={<MaskIcon src="/images/icons/kpi-eye.svg" size={22} />}
              label="Link opens"
              value={formatCount(data.kpis.opens.value)}
              caption="Friends who opened links"
              changePct={data.kpis.opens.changePct}
              changeHint={periodCaption}
            />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
            <Card className="flex flex-col gap-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PanelTitle title="Shares over time" description="Daily link shares per campaign" />
                <div
                  role="tablist"
                  aria-label="Chart period"
                  className="bg-canvas flex gap-1 rounded-xl p-1"
                >
                  {CHART_RANGES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      role="tab"
                      aria-selected={chart === r.value}
                      onClick={() => setChart(r.value)}
                      className={cn(
                        "rounded-[9px] px-3.5 py-1.5 text-xs leading-[normal] font-semibold transition-colors",
                        chart === r.value
                          ? "text-brand-500 bg-white drop-shadow-[0_2px_3px_rgb(74_25_48/0.08)]"
                          : "text-subtle hover:text-muted",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-5">
                {data.chart.series.map((s, i) => (
                  <span
                    key={s.campaignId}
                    className="text-muted flex items-center gap-2 text-xs leading-[normal] font-semibold"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }}
                    />
                    {s.label}
                  </span>
                ))}
              </div>
              <SharesChart days={data.chart.days} series={data.chart.series} />
            </Card>

            <Card className="flex flex-col gap-5 p-6">
              <div className="flex items-center justify-between">
                <PanelTitle title="Live campaigns" description="Share of total link shares" />
                {data.liveCampaigns.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => setAllLive((v) => !v)}
                    aria-expanded={allLive}
                    className="text-brand-500 inline-flex items-center gap-1 text-[13px] leading-[normal] font-semibold whitespace-nowrap hover:underline"
                  >
                    {allLive ? "Show less" : "View all"}
                    <span
                      className={cn("inline-flex transition-transform", allLive && "rotate-90")}
                    >
                      {icon("arrow-right", 14)}
                    </span>
                  </button>
                ) : (
                  <PanelLink href="/campaigns?status=live">View all</PanelLink>
                )}
              </div>
              <ul className="flex flex-col gap-5">
                {data.liveCampaigns.length === 0 && (
                  <li className="text-muted text-sm">No campaigns are live.</li>
                )}
                {(allLive ? data.liveCampaigns : data.liveCampaigns.slice(0, 2)).map((c, i) => (
                  <li key={c.id} className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <MerchantTile
                        name={c.merchantName}
                        logoUrl={null}
                        className="size-11 rounded-xl bg-[#fce7f0] text-lg font-extrabold text-[#e2136e]"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[normal]">
                        <p className="text-ink truncate text-sm font-bold">
                          {c.merchantName} offer
                        </p>
                        <p className="text-subtle truncate text-xs">
                          Ends {endDayLabel(c.endAt)} · {formatCount(c.participants)} users
                        </p>
                      </div>
                      <StatusBadge lifecycle="live" />
                    </div>
                    <div className="h-2 overflow-hidden rounded-[4px] bg-[#f1eef0]">
                      <div
                        className="h-full rounded-[4px]"
                        style={{
                          width: `${c.sharePct}%`,
                          background: SERIES_COLORS[i % SERIES_COLORS.length],
                        }}
                      />
                    </div>
                    <p className="flex justify-between text-xs leading-[normal]">
                      <span className="text-muted font-semibold">
                        {formatCount(c.shares)} shares
                      </span>
                      <span
                        className="font-bold"
                        style={{ color: SERIES_COLORS[i % SERIES_COLORS.length] }}
                      >
                        {c.sharePct}%
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-3 gap-3">
                {(["scheduled", "draft", "ended"] as const).map((k) => (
                  <Link
                    key={k}
                    href={`/campaigns?status=${k}`}
                    className="bg-canvas flex flex-col gap-0.5 rounded-xl p-3 leading-[normal] transition-colors hover:bg-[#fce7f0]"
                  >
                    <p className="text-ink text-xl font-extrabold">{data.counts[k]}</p>
                    <p className="text-subtle text-xs font-medium capitalize">{k}</p>
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <PanelTitle
                  title="Top sharers"
                  description="Phone numbers whose links friends opened most"
                />
                <PanelLink href="/leaderboard">View leaderboard</PanelLink>
              </div>
              {/* Figma table: 44px grey header, 64px rows, 20px cell padding. */}
              <table className="w-full table-fixed text-left">
                <colgroup>
                  <col className="w-[72px]" />
                  <col className="w-[212px]" />
                  <col className="w-[130px]" />
                  <col className="w-[100px]" />
                  <col className="w-[100px]" />
                  <col />
                </colgroup>
                <thead className="bg-canvas border-line border-b">
                  <tr className="text-subtle h-11 text-[11px] leading-[normal] font-bold uppercase">
                    <th className="px-5">Rank</th>
                    <th className="px-5">Phone number</th>
                    <th className="px-5">Campaign</th>
                    <th className="px-5">Shares</th>
                    <th className="px-5">Opens</th>
                    <th className="px-5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topSharers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-muted px-6 py-8 text-center text-sm">
                        No shares yet.
                      </td>
                    </tr>
                  )}
                  {data.topSharers.map((t) => {
                    const ci = data.liveCampaigns.findIndex((c) => c.id === t.campaignId);
                    return (
                      <tr
                        key={`${t.participantId}-${t.campaignId}`}
                        className="border-line h-16 border-b text-sm leading-[normal] last:border-b-0"
                      >
                        <td className="px-5">
                          <RankBadge rank={t.rank} />
                        </td>
                        <td className="text-ink px-5 font-semibold">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            {icon("phone-14", 14)}
                            {formatPhone(t.phone)}
                          </span>
                        </td>
                        <td className="px-5">
                          <span
                            className={cn(
                              "inline-block max-w-full truncate rounded-full px-2.5 py-[3px] text-xs font-semibold",
                              ci === 0
                                ? "bg-[#fce7f0] text-[#e2136e]"
                                : "bg-[#f1eef0] text-[#5d5358]",
                            )}
                          >
                            {t.campaignName}
                          </span>
                        </td>
                        <td className="text-ink px-5 font-bold tabular-nums">
                          {formatCount(t.shares)}
                        </td>
                        <td className="text-muted px-5 font-medium tabular-nums">
                          {formatCount(t.opens)}
                        </td>
                        <td className="px-5">
                          <Link
                            href={`/participants?participant=${t.participantId}`}
                            className="text-brand-500 inline-flex items-center gap-0.5 text-xs font-semibold hover:underline"
                          >
                            Details {icon("chevron-right-pink", 14)}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            <Card className="flex flex-col gap-[18px] p-6">
              <PanelTitle title="Recent activity" description="Latest events across campaigns" />
              <ActivityFeed items={data.activity} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
