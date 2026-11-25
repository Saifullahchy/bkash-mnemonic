"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatCount, pluralize } from "@/lib/formatters";
import type { OfferActivity } from "../types";

/**
 * "Your Sharing Activity" (Figma group 233:1521, After Login screen).
 * Card 337×166 (centred: Figma has it 22px/16px from the screen edges), 150×76 tiles that scroll
 * sideways with snapping; the edges fade while more tiles are off-screen.
 * Positions inside the card are Figma's minus the 1px border. Figma has it 1px
 * below the hero's top and 32px above "Share to win" (hence mt-px / -mb-2).
 */
export function SharingActivity({ activity }: { activity: OfferActivity[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft > 2, end: el.scrollLeft < max - 2 });
  }, []);

  useEffect(() => {
    measure();
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, activity.length]);

  const fade = 24;
  const mask = `linear-gradient(to right, ${edges.start ? "transparent" : "#000"} 0, #000 ${fade}px, #000 calc(100% - ${fade}px), ${edges.end ? "transparent" : "#000"} 100%)`;

  return (
    <section
      aria-labelledby="sharing-activity-title"
      className="mx-[7px] mt-px -mb-2 rounded-[20px] border border-[#e2136e] bg-white pt-[13px] pb-3 shadow-[0_4px_30px_0_rgb(215_25_102/0.3)] md:mx-0"
    >
      <div className="flex flex-col gap-1 px-[9px] text-center">
        <h2
          id="sharing-activity-title"
          className="text-[22px] leading-[27px] font-extrabold text-[#21181c]"
        >
          Your Sharing Activity
        </h2>
        <p className="text-xs leading-[17px] text-[#5d5358]">A quick look at this campaign.</p>
      </div>

      <ul
        ref={listRef}
        onScroll={measure}
        aria-label="Friends who opened your links, per offer"
        className="mt-[15px] flex snap-x snap-mandatory scroll-px-3 [scrollbar-width:none] gap-2.5 overflow-x-auto overscroll-x-contain px-3 [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {activity.map((item) => (
          <li
            key={item.campaignId}
            className={cn(
              "relative h-[76px] snap-start rounded-[20px] border border-[#eaeaea] bg-white",
              // Up to 2 tiles fill the card like Figma (2 × 150 + 10 on a 375px phone, wider
              // on bigger phones); 3+ keep Figma's 150px and scroll sideways
              // (on desktop they share the row first).
              activity.length <= 2
                ? "min-w-[150px] flex-1"
                : "w-[150px] shrink-0 md:w-auto md:min-w-[150px] md:flex-1",
            )}
          >
            <p className="absolute top-2 left-10 w-[97px] truncate text-xs leading-[normal] font-semibold text-black">
              {item.label}
            </p>
            <Image
              src="/images/icons/cursor-click.svg"
              alt=""
              aria-hidden
              width={26}
              height={26}
              unoptimized
              className="absolute top-[35px] left-[7.6px]"
            />
            <p className="absolute top-[29px] left-[39px] max-w-[104px] truncate text-xl leading-[normal] font-semibold text-[#21181c]">
              {formatCount(item.opens)} {pluralize(item.opens, "friend")}
            </p>
            <p className="absolute top-[49px] left-[39px] text-xs leading-[normal] font-semibold whitespace-nowrap text-[#e2136e]">
              Opened your link
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
