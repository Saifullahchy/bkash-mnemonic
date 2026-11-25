"use client";

import { ExportButton } from "@/features/exports/components/ExportButton";
import { exportPath } from "@/features/exports/useDownload";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, PanelTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { useMeQuery } from "@/features/auth/api/authApi";
import { useListCampaignsQuery } from "@/features/campaigns/api/campaignsApi";
import { RankBadge } from "@/features/dashboard/components/RankBadge";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime, formatPhone, timeAgo } from "@/lib/formatters";
import { useGetLeaderboardQuery } from "../api/leaderboardApi";
import { AnnounceWinnersDialog } from "./AnnounceWinnersDialog";
import { Podium } from "./Podium";
import { PrizeHero } from "./PrizeHero";

const PAGE_SIZE = 10;

/** Figma "Full ranking" columns (238:671); the action column takes the rest. */
const COLUMNS: { label: string; width?: number }[] = [
  { label: "Rank", width: 80 },
  { label: "Phone number", width: 240 },
  { label: "Shares", width: 130 },
  { label: "Link opens", width: 130 },
  { label: "Opens per share", width: 170 },
  { label: "Last shared", width: 170 },
  { label: "" },
];

export function LeaderboardScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: me } = useMeQuery();

  // Campaigns with a leaderboard: published and started (live or ended).
  const { data: campaignList } = useListCampaignsQuery({ status: "all", page: 1, limit: 100 });
  const campaigns = useMemo(
    () =>
      (campaignList?.items ?? []).filter((c) => c.lifecycle === "live" || c.lifecycle === "ended"),
    [campaignList],
  );
  const selectedId =
    params.get("campaign") ?? campaigns.find((c) => c.lifecycle === "live")?.id ?? campaigns[0]?.id;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.replace(/\D/g, "")), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const select = (id: string, nextPage = 1) => {
    const q = new URLSearchParams({ campaign: id });
    if (nextPage > 1) q.set("page", String(nextPage));
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const podiumQuery = useGetLeaderboardQuery(
    { id: selectedId ?? "", page: 1, limit: 3 },
    { skip: !selectedId },
  );
  const tableQuery = useGetLeaderboardQuery(
    { id: selectedId ?? "", page, limit: PAGE_SIZE, ...(search ? { search } : {}) },
    { skip: !selectedId },
  );
  const [announceOpen, setAnnounceOpen] = useState(false);

  const board = podiumQuery.data;
  const campaign = board?.campaign;
  const announced = Boolean(campaign?.winnerAnnouncedAt);
  const canAnnounce =
    me?.role === "admin" &&
    campaign?.lifecycle === "ended" &&
    !announced &&
    (board?.items.length ?? 0) > 0;
  const announceHint = !campaign
    ? ""
    : announced
      ? "Winners were already announced"
      : campaign.lifecycle !== "ended"
        ? "Available after the campaign ends"
        : "";
  // Page 1 already shows ranks 1–3 on the podium.
  const tableRows = (tableQuery.data?.items ?? []).filter((r) => search || page > 1 || r.rank > 3);
  const pageCount = Math.max(1, Math.ceil((tableQuery.data?.total ?? 0) / PAGE_SIZE));
  const basisLabel = campaign?.rankingBasis === "shares" ? "link shares" : "link opens";

  return (
    <>
      <PageHeader
        title="Leaderboard"
        description={`Top sharers per campaign, ranked by ${basisLabel}.`}
        actions={
          <>
            {campaigns.length > 0 && (
              <label className="block">
                <span className="sr-only">Campaign</span>
                <Select
                  value={selectedId}
                  onChange={(e) => select(e.target.value)}
                  leading={
                    <MaskIcon src="/images/icons/nav-mega.svg" size={16} className="text-ink" />
                  }
                  boxClassName="h-11 w-[164px] gap-2 bg-white px-5"
                  className="text-sm font-semibold"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.merchantName} offer
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {selectedId && (
              <ExportButton path={exportPath("leaderboard", { campaignId: selectedId })} />
            )}
            <Button
              size="lg"
              disabled={!canAnnounce}
              title={announceHint}
              onClick={() => setAnnounceOpen(true)}
            >
              <MaskIcon src="/images/icons/nav-trophy.svg" size={16} /> Announce winner
            </Button>
          </>
        }
      />

      {campaigns.length > 1 && (
        // Figma "Tabs" (238:594): 40px pills, 13px semibold; active pink with a shadow.
        <div className="mb-6 flex flex-wrap gap-2">
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c.id)}
              aria-pressed={c.id === selectedId}
              className={cn(
                "h-10 rounded-full px-[18px] text-[13px] leading-[normal] font-semibold transition-colors",
                c.id === selectedId
                  ? "shadow-brand bg-[#e2136e] text-white"
                  : "border-line text-muted border bg-white hover:bg-zinc-50",
              )}
            >
              {c.merchantName} offer
            </button>
          ))}
        </div>
      )}

      {!selectedId && campaignList && (
        <Card className="text-muted px-6 py-16 text-center text-sm">
          No campaign has started yet, so there is no leaderboard.
        </Card>
      )}
      {selectedId && !board && (
        <div className="grid place-items-center py-24">
          <Spinner className="size-7" label="Loading leaderboard" />
        </div>
      )}

      {board && campaign && (
        <div className="space-y-6">
          <PrizeHero campaign={campaign} />
          {board.items.length === 0 ? (
            <Card className="text-muted px-6 py-12 text-center text-sm">
              Nobody has joined this campaign yet.
            </Card>
          ) : (
            <Podium rows={board.items} announced={announced} />
          )}

          <Card className="overflow-clip">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
              <PanelTitle
                title="Full ranking"
                description={`${campaign.merchantName} offer · ${
                  announced
                    ? `winners announced ${timeAgo(campaign.winnerAnnouncedAt!)}`
                    : "updated a few seconds ago"
                }`}
              />
              <label className="bg-field focus-within:border-brand-500 flex h-11 w-[280px] items-center gap-2.5 rounded-xl border border-transparent px-4 text-[#8e8589] focus-within:bg-white focus-within:shadow-[0_0_0_3px_#fce7f0]">
                <MaskIcon src="/images/icons/search.svg" size={18} />
                <span className="sr-only">Search phone number</span>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  inputMode="numeric"
                  placeholder="Search phone number"
                  className="text-ink placeholder:text-subtle w-full bg-transparent text-[13px] leading-[normal] outline-none"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] table-fixed text-left leading-[normal]">
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
                  {tableRows.length === 0 && !tableQuery.isFetching && (
                    <tr>
                      <td colSpan={7} className="text-muted px-6 py-8 text-center text-sm">
                        {search
                          ? "No participant with that number in this campaign."
                          : "No more participants."}
                      </td>
                    </tr>
                  )}
                  {tableRows.map((r) => (
                    <tr
                      key={r.shareLinkId}
                      className="border-line h-15 border-b text-sm font-medium text-[#5d5358] last:border-b-0"
                    >
                      <td className="px-5">
                        <RankBadge rank={r.rank} />
                      </td>
                      <td className="text-ink px-5 font-semibold">
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <MaskIcon
                            src="/images/icons/phone-14.svg"
                            size={14}
                            className="text-subtle"
                          />
                          {formatPhone(r.phone)}
                          {r.suspicious && (
                            <span
                              title={r.suspiciousReason ?? "Flagged"}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                            >
                              <Flag className="size-3" aria-hidden /> Flagged
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="text-ink px-5 font-bold tabular-nums">
                        {formatCount(r.shares)}
                      </td>
                      <td className="px-5 tabular-nums">{formatCount(r.opens)}</td>
                      <td className="px-5 tabular-nums">{r.opensPerShare.toFixed(2)}</td>
                      <td className="px-5 text-[13px] whitespace-nowrap">
                        {r.lastSharedAt ? formatDateTime(r.lastSharedAt) : "—"}
                      </td>
                      <td className="px-5">
                        <Link
                          href={`/participants?participant=${r.participantId}`}
                          className="inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap text-[#e2136e] hover:underline"
                        >
                          View activity
                          <MaskIcon src="/images/icons/chevron-right-pink.svg" size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!search && pageCount > 1 && (
              <div className="border-line flex justify-end border-t p-5">
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onChange={(p) => selectedId && select(selectedId, p)}
                />
              </div>
            )}
          </Card>

          <AnnounceWinnersDialog
            open={announceOpen}
            campaign={campaign}
            winners={board.items.slice(0, campaign.numberOfWinners)}
            onClose={() => setAnnounceOpen(false)}
          />
        </div>
      )}
    </>
  );
}
