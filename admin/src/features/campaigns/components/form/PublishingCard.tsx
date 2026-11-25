import { Card } from "@/components/ui/Card";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { cn } from "@/lib/cn";
import type { Lifecycle } from "../../types";

const STAGES: { value: Lifecycle; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
];

const ITEMS = [
  { key: "basicInfo", label: "Basic information" },
  { key: "reward", label: "Reward & winners" },
  { key: "schedule", label: "Schedule" },
  { key: "banner", label: "Offer banner" },
  { key: "rewardImage", label: "Reward banner image" },
  { key: "prizeTile", label: "Prize tile image" },
] as const;

interface PublishingCardProps {
  lifecycle: Lifecycle;
  readiness: Record<(typeof ITEMS)[number]["key"], boolean>;
}

/**
 * Current stage + publish checklist (the prize images are recommended, not required).
 * Figma "Publishing" (237:1107): 20px padding, 16px gaps, segmented status, 20px check dots.
 */
export function PublishingCard({ lifecycle, readiness }: PublishingCardProps) {
  return (
    <Card className="flex flex-col gap-4 p-5 leading-[normal]">
      <h2 className="text-ink text-base font-bold">Publishing</h2>

      <div
        aria-label={`Status: ${lifecycle}`}
        className="bg-canvas grid grid-cols-3 gap-1 rounded-xl p-1"
      >
        {STAGES.map((stage) => (
          <span
            key={stage.value}
            className={cn(
              "grid h-[34px] place-items-center rounded-[9px] text-xs font-semibold",
              stage.value === lifecycle
                ? "bg-white text-[#e2136e] shadow-[0_2px_3px_rgb(74_25_48/0.08)]"
                : "text-subtle",
            )}
          >
            {stage.label}
          </span>
        ))}
      </div>
      {lifecycle === "ended" && (
        <p className="text-muted -mt-2 text-xs">This campaign has ended.</p>
      )}

      <ul className="flex flex-col gap-2.5">
        {ITEMS.map((item) => {
          const done = readiness[item.key];
          return (
            <li
              key={item.key}
              className={cn(
                "flex items-center gap-2.5 text-[13px] font-medium",
                done ? "text-ink" : "text-subtle",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full",
                  done ? "bg-[#e2136e] text-white" : "border border-[#eae3e6] bg-white",
                )}
              >
                {done && <MaskIcon src="/images/icons/check-12.svg" size={12} />}
              </span>
              {item.label}
              <span className="sr-only">{done ? "(done)" : "(missing)"}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
