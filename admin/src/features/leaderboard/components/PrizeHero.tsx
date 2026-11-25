/* eslint-disable @next/next/no-img-element -- tiny decorative Figma SVGs */
import { daysLeft, endDateLabel } from "@/lib/dates";
import { formatCount } from "@/lib/formatters";
import type { LeaderboardCampaign } from "../types";

/** Figma sparkles: [left, top, size] inside the 1112px banner. */
const SPARKLES: [number, number, number][] = [
  [470, 26, 14],
  [860, 22, 10],
  [640, 110, 12],
  [960, 100, 9],
];

/**
 * Figma "Prize banner" (238:599): 148px tall, 20px radius, burgundy → pink
 * gradient, a soft white glow circle, gold sparkles, prize text on the left and
 * three glass stat tiles on the right.
 */
export function PrizeHero({ campaign }: { campaign: LeaderboardCampaign }) {
  const left = daysLeft(campaign.endAt);
  const stats = [
    { label: "Participants", value: formatCount(campaign.stats.participants) },
    { label: "Total shares", value: formatCount(campaign.stats.shares) },
    {
      label: campaign.lifecycle === "ended" ? "Status" : "Time left",
      value:
        campaign.lifecycle === "ended"
          ? campaign.winnerAnnouncedAt
            ? "Announced"
            : "Ended"
          : `${left} ${left === 1 ? "day" : "days"}`,
    },
  ];
  return (
    <section
      className="relative flex min-h-[148px] flex-wrap items-center justify-between gap-6 overflow-clip rounded-[20px] px-8 py-6 leading-[normal] text-white shadow-[0_8px_22px_rgb(74_25_48/0.22)]"
      style={{ backgroundImage: "linear-gradient(90deg, #4d082b 0%, #b70d57 55%, #ed3385 100%)" }}
    >
      <span
        aria-hidden
        className="absolute top-[-110px] left-[520px] size-80 rounded-full bg-white/12"
      />
      {SPARKLES.map(([x, y, size]) => (
        <img
          key={`${x}-${y}`}
          src="/images/icons/sparkle.svg"
          alt=""
          aria-hidden
          width={size}
          height={size}
          className="absolute"
          style={{ left: x, top: y }}
        />
      ))}

      <div className="relative flex flex-col items-start gap-2">
        <p className="text-[11px] font-bold text-[#ffeda6]">TOP SHARER WINS</p>
        <h2 className="text-[30px] font-extrabold">{campaign.rewardTitle}</h2>
        <p className="flex h-[25px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#ffeda6] to-[#ffc74d] px-3 text-xs font-bold text-[#4d082b]">
          <span aria-hidden className="font-normal">
            🏆
          </span>
          Rank #1{campaign.numberOfWinners > 1 ? `–${campaign.numberOfWinners}` : ""} wins ·{" "}
          {campaign.merchantName} offer · ends {endDateLabel(campaign.endAt)}
        </p>
      </div>

      <dl className="relative flex gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex w-[132px] flex-col-reverse gap-0.5 rounded-2xl border border-white/24 bg-white/14 px-[18px] py-3.5"
          >
            <dt className="text-xs font-medium text-white/80">{s.label}</dt>
            <dd className="text-xl font-extrabold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
