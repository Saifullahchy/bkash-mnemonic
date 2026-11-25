import { cn } from "@/lib/cn";
import type { Lifecycle } from "../types";

const STYLES: Record<Lifecycle, { label: string; pill: string; dot: string }> = {
  live: { label: "Live", pill: "bg-[#fce7f0] text-[#e2136e]", dot: "bg-[#e2136e]" },
  scheduled: { label: "Scheduled", pill: "bg-[#fff4db] text-[#b7791f]", dot: "bg-[#b7791f]" },
  draft: { label: "Draft", pill: "bg-[#f1eef0] text-[#5d5358]", dot: "bg-[#5d5358]" },
  ended: { label: "Ended", pill: "bg-[#f1eef0] text-[#8e8589]", dot: "bg-[#8e8589]" },
};

export function StatusBadge({
  lifecycle,
  className,
}: {
  lifecycle: Lifecycle;
  className?: string;
}) {
  const style = STYLES[lifecycle];
  return (
    <span
      className={cn(
        // Figma "Badge / Live": 10/4 padding, 6px dot, 12px semibold.
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[normal] font-semibold",
        style.pill,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}
