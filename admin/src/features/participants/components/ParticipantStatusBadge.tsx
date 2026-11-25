import { cn } from "@/lib/cn";
import type { ParticipantStatus } from "../types";

const STYLES: Record<ParticipantStatus, { label: string; pill: string; dot: string }> = {
  active: { label: "Active", pill: "bg-[#e6f6ec] text-[#12a150]", dot: "bg-[#12a150]" },
  idle: { label: "Idle", pill: "bg-[#f1eef0] text-[#5d5358]", dot: "bg-[#8e8589]" },
  disqualified: { label: "Disqualified", pill: "bg-red-50 text-red-700", dot: "bg-red-500" },
};

/** Figma "Status" pill: 12px semibold, 10px × 4px padding, 6px dot. */
export function ParticipantStatusBadge({ status }: { status: ParticipantStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-[normal] font-semibold whitespace-nowrap",
        s.pill,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
