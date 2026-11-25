import type { ReactNode } from "react";
import { TrendingDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatChange } from "@/lib/formatters";
import { Card } from "./Card";
import { MaskIcon } from "./MaskIcon";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  caption?: string;
  changePct?: number | null;
  /** Tooltip for the change chip, e.g. "vs previous 7 days". */
  changeHint?: string;
  badge?: ReactNode;
  /**
   * "column" = Dashboard KPI (icon + chip on top, 32px number below);
   * "row" = Participants stat (48px icon tile, label over a 26px number, chip on the right).
   */
  layout?: "column" | "row";
}

/** KPI tile: icon, change chip, label, big number, caption (Dashboard & Participants). */
export function StatCard({
  icon,
  label,
  value,
  caption,
  changePct,
  changeHint,
  badge,
  layout = "column",
}: StatCardProps) {
  const up = (changePct ?? 0) >= 0;
  const chip =
    badge ??
    (changePct !== undefined && changePct !== null && (
      <span
        title={changeHint}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs leading-[normal] font-bold",
          up ? "bg-[#e6f6ec] text-[#12a150]" : "bg-red-50 text-red-600",
        )}
      >
        {up ? (
          <MaskIcon src="/images/icons/trend-up.svg" size={12} />
        ) : (
          <TrendingDown className="size-3" aria-hidden />
        )}
        {formatChange(changePct)}
      </span>
    ));

  if (layout === "row") {
    // Figma "Stat / …" (Participants, node 238:942): 20px padding, 16px gaps, 48px tile (14px radius).
    return (
      <Card className="flex items-center gap-4 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#fce7f0] text-[#e2136e] [&>svg]:size-[22px]">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-[normal]">
          <p className="text-muted text-[13px] font-medium">{label}</p>
          <p className="text-ink text-[26px] font-extrabold tabular-nums">{value}</p>
        </div>
        {chip}
      </Card>
    );
  }

  // Figma "KPI / …" (node 236:593): 20px padding, 14px gap, 44px icon tile.
  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-xl bg-[#fce7f0] text-[#e2136e] [&>svg]:size-[22px]">
          {icon}
        </span>
        {chip}
      </div>
      <div className="flex flex-col gap-1 leading-[normal]">
        <p className="text-muted text-[13px] font-medium">{label}</p>
        <p className="text-ink text-[32px] font-extrabold tabular-nums">{value}</p>
        {caption && <p className="text-subtle text-xs">{caption}</p>}
      </div>
    </Card>
  );
}
