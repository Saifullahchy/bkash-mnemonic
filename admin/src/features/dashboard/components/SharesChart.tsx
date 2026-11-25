"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { dayKeyLabel } from "@/lib/dates";
import { formatCount } from "@/lib/formatters";

/** Figma "Shares over time": pink, burgundy, then extra campaigns. */
export const SERIES_COLORS = ["#e2136e", "#800038", "#f59e0b", "#8e8589"];

interface SharesChartProps {
  days: string[];
  series: { campaignId: string; label: string; values: number[] }[];
}

/*
 * Geometry from Figma "Plot" (node 236:676): a 36px y-label column, 16px gap,
 * then a 236px-tall plot whose gridlines run from y=8 to y=228 (4 bands of 55px).
 * Each day owns an equal column; points sit at column centres and the x labels
 * are centred under them (6px below the plot).
 */
const PLOT_H = 236;
const TOP = 8;
const BOTTOM = 228;
const Y_COL = 36;
const GAP = 16;

/** Rounds the axis max up to a "nice" number (1, 2, 2.5, 5 × 10^n). */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value / 4)! * pow;
  return step * 4;
}

const compact = (n: number) => (n >= 1000 ? `${Math.round((n / 1000) * 10) / 10}k` : String(n));

/**
 * Smooth path through points (Catmull-Rom → cubic Bézier). Control points are
 * clamped to [minY, maxY] so the curve never overshoots below zero.
 */
function smoothPath(points: [number, number][], minY: number, maxY: number): string {
  const clamp = (v: number) => Math.min(maxY, Math.max(minY, v));
  if (points.length < 2) return points.length ? `M${points[0]![0]},${points[0]![1]}` : "";
  let d = `M${points[0]![0]},${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** "Shares over time": daily counted shares per live campaign, with hover details. */
export function SharesChart({ days, series }: SharesChartProps) {
  const gradientId = useId();
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(616);
  const [hover, setHover] = useState<number | null>(null);

  // Draw at real pixel size (no viewBox scaling), so strokes and text match Figma.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(120, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { max, col, x, y } = useMemo(() => {
    const peak = Math.max(0, ...series.flatMap((s) => s.values));
    const maxValue = niceMax(peak);
    const column = width / Math.max(1, days.length);
    return {
      max: maxValue,
      col: column,
      x: (i: number) => column * (i + 0.5),
      y: (v: number) => BOTTOM - (v / maxValue) * (BOTTOM - TOP),
    };
  }, [days.length, series, width]);

  if (days.length === 0 || series.length === 0) {
    return (
      <p className="text-subtle grid h-60 place-items-center text-sm">
        No live campaigns to chart yet.
      </p>
    );
  }

  const ticks = [4, 3, 2, 1, 0].map((i) => (max / 4) * i);
  // Keep x labels readable on long ranges (30D / All): label every n-th day.
  const labelEvery = Math.max(1, Math.ceil(52 / col));

  return (
    <div className="flex gap-4">
      {/* Y labels */}
      <div
        aria-hidden
        className="text-subtle flex shrink-0 flex-col items-end justify-between text-[11px] leading-[normal] font-medium"
        style={{ width: Y_COL, height: PLOT_H }}
      >
        {ticks.map((t) => (
          <span key={t}>{compact(t)}</span>
        ))}
      </div>

      <div
        className="relative flex min-w-0 flex-1 flex-col gap-1.5"
        style={{ maxWidth: `calc(100% - ${Y_COL + GAP}px)` }}
      >
        <div ref={plotRef} className="relative" style={{ height: PLOT_H }}>
          <svg
            width={width}
            height={PLOT_H}
            className="block overflow-visible"
            role="img"
            aria-label={`Daily shares: ${series.map((s) => `${s.label} ${s.values.reduce((a, b) => a + b, 0)}`).join(", ")}`}
            onPointerLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              const i = Math.floor((e.clientX - box.left) / col);
              setHover(Math.min(days.length - 1, Math.max(0, i)));
            }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity="0.22" />
                <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity="0" />
              </linearGradient>
            </defs>

            {ticks.map((t) => (
              <line
                key={t}
                x1={0}
                x2={width}
                y1={y(t) + 0.5}
                y2={y(t) + 0.5}
                stroke="#eae3e6"
                strokeDasharray="4 4"
              />
            ))}

            {hover !== null && (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={TOP}
                y2={BOTTOM}
                stroke="#d7cfd3"
                strokeDasharray="3 3"
              />
            )}

            {series.map((s, si) => {
              const points = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
              const line = smoothPath(points, TOP, BOTTOM);
              const color = SERIES_COLORS[si % SERIES_COLORS.length];
              const last = points.at(-1)!;
              return (
                <g key={s.campaignId}>
                  {si === 0 && (
                    <path
                      d={`${line} L${last[0]},${BOTTOM} L${points[0]![0]},${BOTTOM} Z`}
                      fill={`url(#${gradientId})`}
                    />
                  )}
                  <path
                    d={line}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={last[0]}
                    cy={last[1]}
                    r={5}
                    fill="white"
                    stroke={color}
                    strokeWidth={3}
                  />
                </g>
              );
            })}
          </svg>

          {hover !== null && (
            <div
              className="border-line shadow-card pointer-events-none absolute top-0 z-10 rounded-lg border bg-white px-3 py-2 text-xs leading-[normal]"
              style={{
                left: x(hover),
                transform: `translateX(${hover > days.length / 2 ? "calc(-100% - 10px)" : "10px"})`,
              }}
            >
              <p className="text-ink mb-1 font-semibold">{dayKeyLabel(days[hover]!)}</p>
              {series.map((s, si) => (
                <p
                  key={s.campaignId}
                  className="text-muted flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }}
                  />
                  {s.label}:{" "}
                  <span className="text-ink font-semibold">
                    {formatCount(s.values[hover] ?? 0)}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* X labels: one equal column per day, text centred */}
        <div aria-hidden className="flex">
          {days.map((day, i) => (
            <span
              key={day}
              className="text-subtle shrink-0 text-center text-[11px] leading-[normal] font-medium whitespace-nowrap"
              style={{ width: col }}
            >
              {i % labelEvery === 0 || i === days.length - 1 ? dayKeyLabel(day) : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
