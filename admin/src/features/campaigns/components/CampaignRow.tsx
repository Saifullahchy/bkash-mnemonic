"use client";

import Link from "next/link";
import { ArrowUpRight, Rocket, Trash2, Undo2 } from "lucide-react";
import Image from "next/image";
import { Toggle } from "@/components/ui/Toggle";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { formatDuration } from "@/lib/dates";
import { env } from "@/lib/env";
import { formatCount } from "@/lib/formatters";
import type { AdminCampaign } from "../types";
import { MerchantTile } from "./MerchantTile";
import { StatusBadge } from "./StatusBadge";

export interface RowActions {
  onToggleActive: (campaign: AdminCampaign, isActive: boolean) => void;
  onPublish: (campaign: AdminCampaign) => void;
  onUnpublish: (campaign: AdminCampaign) => void;
  onDelete: (campaign: AdminCampaign) => void;
}

/** Figma "Icon button": 32px, 8px radius, 1px border, 16px icon. */
const squareButton =
  "border-line grid size-8 place-items-center rounded-lg border bg-white hover:bg-canvas disabled:opacity-40";
const rowIcon = (name: string) => (
  <Image src={`/images/icons/${name}.svg`} alt="" aria-hidden width={16} height={16} unoptimized />
);

export function CampaignRow({
  campaign: c,
  canEdit,
  actions,
}: {
  campaign: AdminCampaign;
  canEdit: boolean;
  actions: RowActions;
}) {
  const hasActivity = c.lifecycle === "live" || c.lifecycle === "ended";
  const unused = c.stats.participants === 0;

  const menu: MenuItem[] = [
    ...(c.status === "draft"
      ? [{ label: "Publish", icon: <Rocket />, onSelect: () => actions.onPublish(c) }]
      : []),
    ...(c.status === "published" && unused
      ? [{ label: "Move back to draft", icon: <Undo2 />, onSelect: () => actions.onUnpublish(c) }]
      : []),
    ...(c.lifecycle === "live" && c.isActive
      ? [
          {
            label: "View on site",
            icon: <ArrowUpRight />,
            onSelect: () => window.open(env.NEXT_PUBLIC_SITE_URL, "_blank", "noopener"),
          },
        ]
      : []),
    ...(c.status === "draft" && unused
      ? [
          {
            label: "Delete draft",
            icon: <Trash2 />,
            destructive: true,
            onSelect: () => actions.onDelete(c),
          },
        ]
      : []),
  ];

  // Figma "Row" (node 237:657): 76px tall, 20px cell padding.
  return (
    <tr className="border-line h-[76px] border-b leading-[normal]">
      <td className="px-5">
        <div className="flex items-center gap-3">
          <MerchantTile
            name={c.merchantName}
            logoUrl={c.media.logoUrl}
            muted={c.lifecycle === "ended"}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              href={`/campaigns/${c.id}/edit`}
              className="text-ink block truncate text-sm font-bold hover:underline"
            >
              {c.merchantName}
            </Link>
            <p className="text-subtle truncate text-xs">{c.offerTitle}</p>
          </div>
        </div>
      </td>
      <td className="px-5">
        <StatusBadge lifecycle={c.lifecycle} />
      </td>
      <td className="text-muted px-5 text-[13px] font-medium whitespace-nowrap">
        {formatDuration(c.schedule.startAt, c.schedule.endAt)}
      </td>
      <td className="text-muted truncate px-5 text-[13px] font-medium">{c.reward.title}</td>
      <td className="text-ink px-5 text-sm font-bold tabular-nums">
        {hasActivity ? formatCount(c.stats.shares) : "—"}
      </td>
      <td className="text-muted px-5 text-sm font-medium tabular-nums">
        {hasActivity ? formatCount(c.stats.opens) : "—"}
      </td>
      <td className="px-5">
        <Toggle
          checked={c.isActive}
          disabled={!canEdit}
          label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
          onChange={(value) => actions.onToggleActive(c, value)}
        />
      </td>
      <td className="px-5">
        <div className="flex items-center gap-1.5">
          {canEdit && (
            <Link
              href={`/campaigns/${c.id}/edit`}
              aria-label={`Edit ${c.name}`}
              className={squareButton}
            >
              {rowIcon("edit")}
            </Link>
          )}
          {canEdit &&
            (menu.length > 0 ? (
              <Menu
                label={`More actions for ${c.name}`}
                trigger={rowIcon("more")}
                triggerClassName={squareButton}
                items={menu}
              />
            ) : (
              <button
                type="button"
                disabled
                aria-label="No other actions"
                title="No other actions for this campaign"
                className={squareButton}
              >
                {rowIcon("more")}
              </button>
            ))}
        </div>
      </td>
    </tr>
  );
}
