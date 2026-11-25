import { cn } from "@/lib/cn";

/** Rank circle: gold / silver / bronze for the podium, grey after. */
/** Rank circle (Figma "Rank N"): gold gradient, silver, bronze, then grey. */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  const style =
    rank === 1
      ? "bg-gradient-to-br from-[#ffeda6] to-[#ffc74d] text-[#4d082b]"
      : rank === 2
        ? "bg-[#e4e0e2] text-[#4d082b]"
        : rank === 3
          ? "bg-[#f2c9a0] text-[#4d082b]"
          : "bg-[#f7f5f6] text-[#5d5358]";
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-full text-xs leading-[normal] font-bold",
        style,
        className,
      )}
    >
      {rank}
    </span>
  );
}
