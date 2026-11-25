import Image from "next/image";
import type { CSSProperties } from "react";
import { formatCount } from "@/lib/formatters";
import chooseImg from "../../../../public/images/how-it-works/step-choose.webp";
import shareImg from "../../../../public/images/how-it-works/step-share.webp";
import winImg from "../../../../public/images/how-it-works/step-win.webp";

/** Widths and label line breaks are taken from Figma ("Frame 61", node 79:1265). */
const STEPS = [
  { image: chooseImg, width: 70.118, lines: ["Choose", "an offer"] },
  { image: shareImg, width: 69.294, lines: ["Share with", "your friends"] },
  { image: winImg, width: 70.353, lines: ["Win", "Prizes"] },
] as const;

/**
 * "Share Offers, Win Prizes" card (Figma node 79:1261). The pill intentionally
 * sits 9px over the card's bottom edge, as in the design.
 */
export function HowItWorks({ peopleSharingToday }: { peopleSharingToday: number }) {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="relative flex flex-col items-center gap-6 rounded-2xl border border-white/24 px-3 pt-[21px] drop-shadow-[0_4px_4px_rgb(226_19_110/0.48)] md:gap-9 md:pt-8"
      style={{
        backgroundImage:
          "radial-gradient(406.74px 282.75px at 50% -38.75px, rgb(255 255 255 / 0.3), rgb(255 255 255 / 0)), linear-gradient(#e2136e, #e2136e)",
      }}
    >
      <div className="flex w-full flex-col items-center gap-2 text-center text-white">
        <h2
          id="how-it-works-title"
          className="text-xl leading-6 font-semibold md:text-3xl md:leading-9"
        >
          Share Offers, Win Prizes
        </h2>
        <p className="text-xs leading-[1.4] font-medium md:text-base">
          Three simple steps. That&apos;s it.
        </p>
      </div>

      <ol className="relative flex w-full items-center justify-center gap-[43px] md:gap-[120px]">
        <Image
          src="/images/how-it-works/dotted-line.svg"
          alt=""
          aria-hidden
          width={167}
          height={1}
          unoptimized
          className="absolute top-[34.5px] left-1/2 h-px w-[167px] max-w-none -translate-x-1/2 md:hidden"
        />
        {/* Desktop: same dots, drawn in CSS so they keep their size over the wider gaps. */}
        <span
          aria-hidden
          className="absolute top-[54px] left-1/2 hidden h-[1.5px] w-[370px] -translate-x-1/2 md:block"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.8) 0 3px, transparent 3px 7px)",
          }}
        />
        {STEPS.map(({ image, width, lines }, index) => (
          <li
            key={lines.join(" ")}
            className="relative flex w-(--step-width) shrink-0 flex-col items-center gap-2 md:w-[110px] md:gap-3"
            style={{ "--step-width": `${width}px` } as CSSProperties}
          >
            {/*
              ~596px (8.5x) crops of the Figma source, served as-is: running them through
              the optimizer (q75, one width picked at load) made them blurry when zoomed.
            */}
            <Image
              src={image}
              alt=""
              unoptimized
              preload={index === 0}
              className="h-auto w-full rounded-[11.765px] md:rounded-[18px]"
            />
            <span className="text-center text-xs leading-[1.02] font-medium whitespace-nowrap text-white md:text-base md:leading-tight">
              {lines[0]}
              <br />
              {lines[1]}
            </span>
            <span
              aria-hidden
              className="absolute -top-2 left-1/2 grid size-[18px] -translate-x-1/2 place-items-center rounded-full border border-[rgb(229_24_107/0.1)] bg-[#fce7f1] text-[10px] leading-none text-[#e2136e] shadow-[0_-1px_19px_0_rgb(0_0_0/0.25)]"
            >
              {index + 1}
            </span>
          </li>
        ))}
      </ol>

      {/*
        Figma's Glass effect isn't in its code export (only the 15% black fill), so it is
        rebuilt from the rendered colours: a ~37% white frost under the 15% black, a heavy
        backdrop blur, a light rim and top highlight, and a pink glow below. Insets keep the
        32px Figma height.
      */}
      <p
        className="-mb-[10px] flex items-center gap-2 rounded-[50px] px-3 py-1.5 text-sm whitespace-nowrap shadow-[inset_0_0_0_1px_rgb(255_255_255/0.45),inset_0_1px_1px_0_rgb(255_255_255/0.4),0_6px_14px_-4px_rgb(226_19_110/0.42)] backdrop-blur-xl backdrop-saturate-150"
        style={{
          background:
            "linear-gradient(rgb(0 0 0 / 0.15), rgb(0 0 0 / 0.15)), rgb(255 255 255 / 0.37)",
        }}
      >
        <span aria-hidden>🔥</span>
        <span className="leading-5 font-medium text-white">
          {formatCount(peopleSharingToday)} people sharing today
        </span>
      </p>
    </section>
  );
}
