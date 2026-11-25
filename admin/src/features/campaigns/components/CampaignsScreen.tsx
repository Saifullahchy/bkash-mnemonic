"use client";

import { ExportButton } from "@/features/exports/components/ExportButton";
import { exportPath } from "@/features/exports/useDownload";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu } from "@/components/ui/Menu";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useMeQuery } from "@/features/auth/api/authApi";
import { getApiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import {
  useDeleteCampaignMutation,
  useListCampaignsQuery,
  usePublishCampaignMutation,
  useSetCampaignActiveMutation,
  useUnpublishCampaignMutation,
} from "../api/campaignsApi";
import type { AdminCampaign, CampaignFilter } from "../types";
import { CampaignRow, type RowActions } from "./CampaignRow";
import { StatusTabs } from "./StatusTabs";

const PAGE_SIZE = 10;
const FILTERS: CampaignFilter[] = ["all", "live", "scheduled", "draft", "ended"];
/** Figma "Table header" columns and widths (1112px table). */
const COLUMNS: { label: string; width: number }[] = [
  { label: "Campaign", width: 270 },
  { label: "Status", width: 120 },
  { label: "Duration", width: 180 },
  { label: "Reward", width: 170 },
  { label: "Shares", width: 96 },
  { label: "Opens", width: 96 },
  { label: "Active", width: 70 },
  { label: "", width: 110 },
];
const img = (name: string, size: number) => (
  <Image
    src={`/images/icons/${name}.svg`}
    alt=""
    aria-hidden
    width={size}
    height={size}
    unoptimized
  />
);

/** List state lives in the URL (?status=&search=&active=&page=) so it is shareable and survives reloads. */
export function CampaignsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const { data: me } = useMeQuery();
  const canEdit = me?.role === "admin";

  const status = (FILTERS.find((f) => f === params.get("status")) ?? "all") as CampaignFilter;
  const search = params.get("search") ?? "";
  const active =
    params.get("active") === "true"
      ? "true"
      : params.get("active") === "false"
        ? "false"
        : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const setParams = (next: Record<string, string | undefined>) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "" || (key === "status" && value === "all"))
        merged.delete(key);
      else merged.set(key, value);
    }
    if (!("page" in next)) merged.delete("page");
    router.replace(`${pathname}${merged.size ? `?${merged.toString()}` : ""}`, { scroll: false });
  };

  // Debounced search box mirrored to the URL.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => setParams({ search: searchInput.trim() || undefined }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setParams reads latest params on each render
  }, [searchInput]);

  const { data, isLoading, isFetching, isError, refetch } = useListCampaignsQuery({
    status,
    search: search || undefined,
    active,
    page,
    limit: PAGE_SIZE,
  });

  const [setActive] = useSetCampaignActiveMutation();
  const [publish] = usePublishCampaignMutation();
  const [unpublish] = useUnpublishCampaignMutation();
  const [remove, { isLoading: deleting }] = useDeleteCampaignMutation();
  const [toDelete, setToDelete] = useState<AdminCampaign | null>(null);

  const run = async (action: Promise<{ error?: unknown }>, success: string) => {
    const result = await action;
    if (result.error)
      toast.error(getApiErrorMessage(result.error as Parameters<typeof getApiErrorMessage>[0]));
    else toast.success(success);
  };

  const actions: RowActions = {
    onToggleActive: (c, isActive) =>
      void run(setActive({ id: c.id, isActive }), `${c.name} ${isActive ? "activated" : "paused"}`),
    onPublish: (c) => void run(publish(c.id), `${c.name} published`),
    onUnpublish: (c) => void run(unpublish(c.id), `${c.name} moved back to draft`),
    onDelete: (c) => setToDelete(c),
  };

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Create, schedule and manage your share campaigns."
        actions={
          <>
            <ExportButton path={exportPath("campaigns")} />
            {canEdit && (
              <Link
                href="/campaigns/new"
                className="bg-brand-500 hover:bg-brand-600 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white drop-shadow-[0_4px_6px_rgb(74_25_48/0.18)]"
              >
                {img("btn-plus", 16)}
                New Campaign
              </Link>
            )}
          </>
        }
      />

      {/* Figma "Toolbar" (node 237:583) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <StatusTabs
          value={status}
          counts={data?.counts}
          onChange={(value) => setParams({ status: value })}
        />
        <div className="flex items-center gap-3">
          <label className="border-line flex h-11 w-[280px] items-center gap-2.5 rounded-xl border bg-white px-4 transition-[border-color,box-shadow] focus-within:border-[#e2136e] focus-within:shadow-[0_0_0_3px_#fce7f0]">
            {img("search", 18)}
            <span className="sr-only">Search campaigns</span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search campaigns"
              className="text-ink placeholder:text-subtle w-full bg-transparent text-[13px] outline-none"
            />
          </label>
          <Menu
            label="Filter campaigns"
            triggerClassName={cn(
              "border-line text-ink hover:bg-canvas inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-5 text-sm font-semibold",
              active && "border-[#e2136e] text-[#e2136e]",
            )}
            trigger={
              <>
                {img("filter", 16)}
                {active === "true" ? "Active only" : active === "false" ? "Paused only" : "Filter"}
              </>
            }
            items={[
              { label: "All campaigns", onSelect: () => setParams({ active: undefined }) },
              { label: "Active only", onSelect: () => setParams({ active: "true" }) },
              { label: "Paused only", onSelect: () => setParams({ active: "false" }) },
            ]}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className={cn(
              "w-full min-w-[1040px] table-fixed text-left",
              isFetching && !isLoading && "opacity-70",
            )}
          >
            <colgroup>
              {COLUMNS.map((col) => (
                // The last (actions) column takes the remaining width, so the 1px card
                // borders never push the table into a horizontal scroll.
                <col
                  key={col.label || "actions"}
                  style={col.label ? { width: col.width } : undefined}
                />
              ))}
            </colgroup>
            <thead className="bg-canvas border-line border-b">
              <tr className="h-11">
                {COLUMNS.map((col) => (
                  <th
                    key={col.label || "actions"}
                    scope="col"
                    className="text-subtle px-5 text-[11px] leading-[normal] font-bold uppercase"
                  >
                    {col.label || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="border-line h-[76px] border-b">
                    <td colSpan={COLUMNS.length} className="px-5 py-4">
                      <div className="h-10 animate-pulse rounded-lg bg-zinc-100" />
                    </td>
                  </tr>
                ))}
              {data?.items.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  canEdit={canEdit}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
        </div>

        {isError && (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-ink text-sm font-semibold">Couldn&apos;t load campaigns</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}
        {data && data.items.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-ink text-sm font-semibold">No campaigns found</p>
            <p className="text-muted text-xs">
              {search || active || status !== "all"
                ? "Try a different filter or search."
                : "Create your first campaign to get started."}
            </p>
          </div>
        )}

        {/* Figma "Pagination": 20px padding */}
        <div className="flex items-center justify-between p-5">
          <p className="text-subtle text-[13px] leading-[normal] font-medium">
            Showing {first}–{last} of {total} campaigns
          </p>
          <Pagination
            page={page}
            pageCount={pageCount}
            onChange={(p) => setParams({ page: String(p) })}
          />
        </div>
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this draft?"
        description={`"${toDelete?.name ?? ""}" and its uploaded images will be permanently deleted.`}
        confirmLabel="Delete draft"
        destructive
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await run(remove(toDelete.id), `${toDelete.name} deleted`);
          setToDelete(null);
        }}
      />
    </>
  );
}
