import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/** Figma tick (11px "check", #168A5B), drawn start-to-end so it can animate. */
const TICK = "M1.8337 5.4998L4.12514 7.7913L9.1663 2.75";
const TICK_LENGTH = 10.4;

/**
 * Animated tick: the circle fades in and the tick draws itself, without
 * overshoot so it stays inside its container. Re-mount it (via `key`) to
 * replay. Motion is skipped when the user prefers reduced motion.
 */
export function CopiedCheck({
  circle = true,
  stroke = "#168A5B",
  className,
}: {
  /** Show the 18px mint circle behind the tick (Figma "Success check"). */
  circle?: boolean;
  stroke?: string;
  className?: string;
}) {
  const tick = (
    <svg aria-hidden width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
      <path
        d={TICK}
        stroke={stroke}
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={TICK_LENGTH}
        style={{ "--path-length": TICK_LENGTH } as CSSProperties}
        className="motion-safe:animate-draw"
      />
    </svg>
  );

  if (!circle) return <span className={cn("inline-grid", className)}>{tick}</span>;

  return (
    <span
      className={cn(
        "motion-safe:animate-soft-in grid size-[18px] shrink-0 place-items-center rounded-full bg-[#e8f7f0]",
        className,
      )}
    >
      {tick}
    </span>
  );
}
