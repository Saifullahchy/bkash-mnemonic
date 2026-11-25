import { Flag } from "lucide-react";
import { RankBadge } from "@/features/dashboard/components/RankBadge";
import { cn } from "@/lib/cn";
import { formatCount, formatPhone } from "@/lib/formatters";
import type { LeaderboardRow } from "../types";

/**
 * Figma "Podium #N" (238:621): white cards (20px radius, 24px padding, 14px gaps)
 * for #2 and #3; #1 is the pink → burgundy card with a gold "Current leader" chip,
 * 32px top padding and a deeper shadow, so it stands 43px taller.
 */
function PodiumCard({
  row,
  leader,
  label,
}: {
  row: LeaderboardRow;
  leader?: boolean;
  label?: string;
}) {
  const sub = leader ? "text-white/80" : "text-subtle";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3.5 rounded-[20px] px-6 pb-6 text-center leading-[normal]",
        leader
          ? "pt-8 text-white shadow-[0_12px_14px_rgb(74_25_48/0.28)]"
          : "border-line text-ink shadow-card border bg-white pt-6",
      )}
      style={
        leader
          ? { backgroundImage: "linear-gradient(144.08deg, #e2136e 14.64%, #800038 85.36%)" }
          : undefined
      }
    >
      {leader && label && (
        <span className="flex h-[23px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ffeda6] to-[#ffc74d] px-3 text-[11px] font-bold text-[#4d082b] uppercase">
          <span aria-hidden className="text-xs font-normal">
            🏆
          </span>
          {label}
        </span>
      )}
      <RankBadge rank={row.rank} className="size-12 text-xl font-extrabold" />
      <p className="flex items-center gap-1.5 text-[22px] font-extrabold tabular-nums">
        {formatPhone(row.phone)}
        {row.suspicious && (
          <Flag
            className="size-4 text-amber-500"
            aria-label={`Flagged: ${row.suspiciousReason ?? ""}`}
          />
        )}
      </p>
      <hr className={cn("w-full border-0 border-t", leader ? "border-white/24" : "border-line")} />
      <dl className="grid w-full grid-cols-2 gap-3">
        {[
          { label: "Shares", value: row.shares },
          { label: "Link opens", value: row.opens },
        ].map((m) => (
          <div key={m.label} className="flex flex-col-reverse items-center gap-0.5">
            <dt className={cn("text-xs font-medium", sub)}>{m.label}</dt>
            <dd className="text-[22px] font-extrabold tabular-nums">{formatCount(m.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Top 3 with #1 raised in the middle (2 · 1 · 3), as in the design. */
export function Podium({ rows, announced }: { rows: LeaderboardRow[]; announced: boolean }) {
  const [first, second, third] = rows;
  if (!first) return null;
  return (
    <div className="grid items-end gap-7 lg:grid-cols-3">
      {second ? <PodiumCard row={second} /> : <div className="hidden lg:block" />}
      <PodiumCard row={first} leader label={announced ? "Winner" : "Current leader"} />
      {third ? <PodiumCard row={third} /> : <div className="hidden lg:block" />}
    </div>
  );
}
