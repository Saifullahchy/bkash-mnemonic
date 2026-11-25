import { cn } from "@/lib/cn";
import type { CampaignFilter } from "../types";

const TABS: { value: CampaignFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Draft" },
  { value: "ended", label: "Ended" },
];

interface StatusTabsProps {
  value: CampaignFilter;
  counts: Record<CampaignFilter, number> | undefined;
  onChange: (value: CampaignFilter) => void;
}

export function StatusTabs({ value, counts, onChange }: StatusTabsProps) {
  return (
    <div role="tablist" aria-label="Campaign status" className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              // Figma "Tab …": 40px pill, 16px padding, 8px gap.
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] leading-[normal] font-semibold transition-colors",
              active
                ? "border-[#e2136e] bg-[#e2136e] text-white drop-shadow-[0_4px_6px_rgb(74_25_48/0.18)]"
                : "border-line text-muted hover:bg-canvas bg-white",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-[7px] py-px text-[11px] leading-[normal] font-bold",
                active ? "bg-white/24 text-white" : "bg-canvas text-subtle",
              )}
            >
              {counts?.[tab.value] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}
