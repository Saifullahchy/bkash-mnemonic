import Image from "next/image";
import type { Offer } from "../types";

interface PrizeBannerProps {
  reward: Offer["reward"];
  /** Sweep a soft gold shine across once (used when the details popup opens). */
  shine?: boolean;
}

/**
 * The offer's reward banner: the artwork uploaded in the admin panel, or the
 * built-in banner below when the campaign has none. Always 88px tall (Figma): cards wider
 * than a phone trim the artwork's top and bottom.
 */
export function PrizeBanner({ reward, shine = false }: PrizeBannerProps) {
  if (!reward.bannerImageUrl) return <DefaultPrizeBanner reward={reward} shine={shine} />;
  return (
    <div className="relative h-[88px] w-full overflow-hidden rounded-[14px]">
      <Image
        src={reward.bannerImageUrl}
        alt={`Top sharer wins ${reward.title}`}
        fill
        sizes="(min-width: 768px) 480px, (min-width: 480px) 394px, calc(100vw - 54px)"
        className="object-cover"
      />
      {shine && <Shine />}
    </div>
  );
}

/**
 * "Reward banner" (Figma node 480:785). Decorations are anchored to the right
 * edge so the layout holds on cards wider than the 351px design.
 * The prize picture (uploaded in the admin panel) sits where Figma draws the phone:
 * 74.52px tall and right-aligned, so portrait art on the 51.65×74.52 canvas matches
 * the design exactly, while landscape prizes may grow to 84px wide.
 */
function DefaultPrizeBanner({ reward, shine }: PrizeBannerProps) {
  return (
    <div className="relative h-[88px] overflow-hidden rounded-[14px] border-[1.5px] border-[#ffd633] bg-gradient-to-r from-[#4d082b] via-[#b80d57] via-55% to-[#ed3385] shadow-[0_0_14px_1px_rgb(255_214_51/0.25)]">
      <Decoration
        src="/images/offer/reward-glow.svg"
        size={170}
        className="top-[-41.5px] right-[-55.5px]"
      />
      <Decoration
        src="/images/offer/sparkle-12.svg"
        size={12}
        className="top-[10.5px] right-[111.5px]"
      />
      <Decoration
        src="/images/offer/sparkle-8.svg"
        size={8}
        className="top-[10.5px] right-[-6.5px]"
      />
      <Decoration
        src="/images/offer/sparkle-9.svg"
        size={9}
        className="top-[60.5px] right-[74.5px]"
      />
      <Decoration
        src="/images/offer/sparkle-7.svg"
        size={7}
        className="top-[58.5px] right-[138.5px]"
      />

      {reward.tileImageUrl && (
        <div className="absolute top-[5.5px] right-[9.85px] h-[74.52px] w-[84px]">
          <Image
            src={reward.tileImageUrl}
            alt=""
            fill
            sizes="84px"
            unoptimized
            className="object-contain object-right"
          />
        </div>
      )}

      <p className="absolute top-[12.5px] left-[14.5px] text-[9px] leading-[normal] font-bold tracking-[0.9px] whitespace-nowrap text-[#ffd973] uppercase">
        Top sharer wins
      </p>
      <p className="absolute top-[26.5px] left-[14.5px] max-w-[calc(100%-112px)] truncate text-lg leading-[normal] font-extrabold text-white">
        {reward.title}
      </p>
      <p className="absolute top-[54.5px] left-[14.5px] flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ffeda6] to-[#ffc74d] px-2.5 py-1 leading-[normal] whitespace-nowrap">
        <span aria-hidden className="text-[11px] text-black">
          🏆
        </span>
        <span className="text-[10px] font-bold text-[#21181c]">Rank #{reward.rank}</span>
      </p>

      {shine && <Shine />}

      {/* inner gold glow on top of everything, like Figma's inner shadow */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_10px_0_rgb(255_214_51/0.55)]"
      />
    </div>
  );
}

function Shine() {
  return (
    <span
      aria-hidden
      className="motion-safe:animate-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#ffe9a8]/45 to-transparent opacity-0 motion-safe:opacity-100"
    />
  );
}

function Decoration({ src, size, className }: { src: string; size: number; className: string }) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized
      className={`pointer-events-none absolute max-w-none ${className}`}
    />
  );
}
