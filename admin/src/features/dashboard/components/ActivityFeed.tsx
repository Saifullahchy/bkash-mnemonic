import {
  Ban,
  CalendarCheck,
  CircleSlash,
  Download,
  FileText,
  Flag,
  Megaphone,
  Pause,
  Phone,
  Play,
  Trash2,
  Trophy,
  Undo2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { formatPhone, timeAgo } from "@/lib/formatters";
import type { ActivityItem } from "../types";

const TYPES: Record<string, { icon: LucideIcon; title: string }> = {
  participant_joined: { icon: Phone, title: "New phone verified" },
  campaign_created: { icon: Megaphone, title: "Campaign created" },
  campaign_published: { icon: CalendarCheck, title: "Campaign published" },
  campaign_unpublished: { icon: Undo2, title: "Campaign moved to draft" },
  campaign_paused: { icon: Pause, title: "Campaign paused" },
  campaign_activated: { icon: Play, title: "Campaign activated" },
  campaign_deleted: { icon: Trash2, title: "Draft deleted" },
  winners_announced: { icon: Trophy, title: "Winners announced" },
  participant_disqualified: { icon: Ban, title: "Participant disqualified" },
  participant_reinstated: { icon: UserCheck, title: "Participant reinstated" },
  opens_voided: { icon: CircleSlash, title: "Opens voided" },
  link_flagged: { icon: Flag, title: "Suspicious link flagged" },
  terms_updated: { icon: FileText, title: "Terms updated" },
  export_downloaded: { icon: Download, title: "Excel export downloaded" },
};

function subtitle(item: ActivityItem): string {
  const who =
    item.actor.kind === "participant" ? formatPhone(item.actor.label) : `by ${item.actor.label}`;
  const phone = typeof item.meta.phone === "string" ? formatPhone(item.meta.phone) : null;
  const parts = [
    phone ?? who,
    item.campaignName,
    typeof item.meta.count === "number" ? `${item.meta.count} opens` : null,
    item.type === "link_flagged" && typeof item.meta.reason === "string" ? item.meta.reason : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Figma's own 16px icons for the events it shows; the rest use matching line icons. */
const FIGMA_ICONS: Record<string, string> = {
  participant_joined: "/images/icons/act-phone.svg",
  campaign_created: "/images/icons/act-mega.svg",
  campaign_published: "/images/icons/act-mega.svg",
  terms_updated: "/images/icons/act-file.svg",
  export_downloaded: "/images/icons/act-dl.svg",
};

/** "Recent activity" list (dashboard) — Figma node 236:889. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0)
    return <p className="text-muted py-6 text-center text-sm">No activity yet.</p>;
  return (
    <ul className="flex flex-col gap-[18px]">
      {items.map((item) => {
        const { icon: Icon, title } = TYPES[item.type] ?? { icon: Flag, title: item.type };
        return (
          <li key={item.id} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#fce7f0] text-[#e2136e]">
              {FIGMA_ICONS[item.type] ? (
                <MaskIcon src={FIGMA_ICONS[item.type]!} size={16} />
              ) : (
                <Icon className="size-4" strokeWidth={1.6} aria-hidden />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[normal]">
              <p className="text-ink text-[13px] font-semibold">{title}</p>
              <p className="text-subtle truncate text-xs">{subtitle(item)}</p>
            </div>
            <time
              dateTime={item.createdAt}
              className="text-subtle shrink-0 text-xs leading-[normal] font-medium"
            >
              {timeAgo(item.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
