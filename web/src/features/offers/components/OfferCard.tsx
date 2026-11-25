"use client";

import { BadgePercent, Timer } from "lucide-react";
import Image from "next/image";
import { CopiedCheck } from "@/features/share/components/CopiedCheck";
import { useShareActions } from "@/features/share/hooks/useShareActions";
import { cn } from "@/lib/cn";
import { startShare } from "@/features/share/thunks";
import { formatCount, pluralize } from "@/lib/formatters";
import { useAppDispatch } from "@/store/hooks";
import { modalOpened } from "@/store/slices/uiSlice";
import { useMyActivityFor } from "../hooks/useMyActivity";
import type { Offer } from "../types";
import { OfferBanner } from "./OfferBanner";
import { PrizeBanner } from "./PrizeBanner";

/**
 * Offer card.
 * Phones: Figma "5" (node 480:771); every unprefixed size/colour comes from that frame.
 * Desktop (md+): offer-finder.com's card — merchant circle and pink title above a white
 * card with a 16:7 banner, the offer line, its description and a pink validity strip.
 */
export function OfferCard({ offer, priority }: { offer: Offer; priority?: boolean }) {
  const dispatch = useAppDispatch();
  const mine = useMyActivityFor(offer.id);
  const { copyLink, copied, copyCount } = useShareActions(offer);

  const handleCopy = () => {
    // Copy instantly when the link already exists (keeps the click's clipboard
    // permission); otherwise go through login / link creation in the share modal.
    if (mine?.link) void copyLink(mine.link.url);
    else dispatch(startShare(offer.id));
  };

  const titleId = `offer-${offer.id}-title`;

  return (
    <article aria-labelledby={titleId} className="flex h-full flex-col">
      {/* Desktop heading, above the card */}
      <div className="mb-3 hidden items-center gap-2.5 md:flex">
        <MerchantCircle name={offer.merchantName} logoUrl={offer.logoUrl} />
        <h3 className="min-w-0 truncate py-1 text-xl font-bold text-[#e2136e]">{offer.title}</h3>
      </div>

      <div className="flex flex-1 flex-col overflow-clip rounded-[22px] border border-[#dadada] bg-white shadow-[0_6px_20px_0_rgb(0_0_0/0.1)] md:rounded-2xl md:border-0 md:shadow-none">
        <OfferBanner
          offer={offer}
          sizes="(min-width: 1100px) 510px, (min-width: 768px) calc(50vw - 40px), (min-width: 480px) 424px, calc(100vw - 26px)"
          priority={priority}
          parallax
          className="aspect-[349/152] md:aspect-[16/7]"
        />

        {/* Offer info */}
        <div className="flex items-center justify-between gap-3 py-3 pr-3.5 pl-[17px] leading-[normal] md:px-4 md:pt-5 md:pb-0">
          <p className="hidden min-w-0 flex-1 items-start gap-2.5 text-lg leading-snug font-bold text-[#21171c] md:flex">
            <BadgePercent aria-hidden className="mt-px size-6 shrink-0 fill-[#e2136e] text-white" />
            <span className="min-w-0">{offer.subtitle}</span>
          </p>
          <div className="flex min-w-0 flex-col gap-1 md:hidden">
            <h3 id={titleId} className="truncate text-[13px] leading-4 font-bold text-[#21171c]">
              {offer.title}
            </h3>
            <p className="truncate text-[10.5px] leading-[13px] text-[#73696e]">{offer.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => dispatch(modalOpened({ type: "offerDetails", campaignId: offer.id }))}
            className="group flex shrink-0 items-center gap-1 rounded-full border border-[#e3126e] px-3 py-1.5 text-[11px] font-medium whitespace-nowrap text-[#e3126e] transition-[background-color,transform] duration-150 hover:bg-[#e3126e]/5 active:scale-95 md:text-sm"
          >
            Offer Details{" "}
            <span
              aria-hidden
              className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </button>
        </div>

        {/* Desktop description + validity strip (the strip stays at the bottom of the text) */}
        <div className="hidden flex-1 flex-col gap-4 px-4 pt-4 md:flex">
          {offer.description && (
            <p className="line-clamp-2 text-sm leading-relaxed text-[#21171c]/75 lg:text-base lg:leading-relaxed">
              {offer.description}
            </p>
          )}
          {offer.validityLabel && (
            <p className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-[#e2136e]/20 bg-[#e2136e]/5 px-4 py-3 text-sm leading-snug">
              <span className="flex items-center gap-2 font-medium text-[#21171c]">
                <Timer aria-hidden className="size-5 shrink-0 text-[#e2136e]" />
                Offer validity
              </span>
              <span className="font-semibold text-[#e2136e]">{offer.validityLabel}</span>
            </p>
          )}
        </div>

        {/* Divider (1px spacer in the design) */}
        <div aria-hidden className="h-px" />

        {/* Reward row */}
        <div className="px-3.5 py-2 md:px-4 md:py-4">
          <PrizeBanner reward={offer.reward} />
        </div>

        {/*
        Stats: only for a logged-in participant — the opens counted on *their* share
        link for this campaign (matched to their phone number via the session).
        Guests see no text, but the row keeps its Figma height (15.67px line + 12px)
        so the spacing between the reward banner and the buttons stays the same.
      */}
        <div
          className={cn("flex min-h-[27.67px] justify-center px-3.5 pb-3", !mine && "md:hidden")}
        >
          {mine && (
            <p className="flex items-center gap-1.5 text-[11.5px] leading-[normal] text-[#73696e] md:text-sm">
              <Image
                src="/images/icons/tap.svg"
                alt=""
                aria-hidden
                width={12.7}
                height={15.67}
                unoptimized
              />
              <span>
                <span className="font-bold text-[#21171c]">{formatCount(mine.opens)}</span>{" "}
                {pluralize(mine.opens, "person", "people")} opened your link
              </span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 px-3.5 pb-2.5 md:gap-3 md:px-4">
          <button
            type="button"
            onClick={handleCopy}
            aria-live="polite"
            className="flex h-11 flex-1 items-center justify-center overflow-hidden rounded-xl border-[1.25px] border-[#e3126e] bg-white text-[13px] leading-[normal] font-semibold text-[#e3126e] transition-[background-color,transform] duration-150 hover:bg-[#e3126e]/5 active:scale-[0.98] md:h-12 md:text-base"
          >
            {/* keyed so the pop replays on every copy without remounting the button */}
            <span
              key={copyCount}
              className={cn(
                "flex items-center gap-2",
                copyCount > 0 && "motion-safe:animate-soft-in",
              )}
            >
              {copied ? (
                <CopiedCheck
                  circle={false}
                  stroke="#e3126e"
                  className="size-4 place-items-center"
                />
              ) : (
                <Image
                  src="/images/icons/copy.svg"
                  alt=""
                  aria-hidden
                  width={12.81}
                  height={16}
                  unoptimized
                />
              )}
              {copied ? "Copied!" : "Copy Link"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => dispatch(startShare(offer.id))}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#e3126e] text-[13px] font-semibold text-white shadow-[0_4px_12px_0_rgb(227_18_110/0.28)] transition-colors hover:bg-[#c70f60] md:h-12 md:text-base"
          >
            <Image
              src="/images/icons/send.svg"
              alt=""
              aria-hidden
              width={13}
              height={13}
              unoptimized
            />
            Share Offer
          </button>
        </div>

        {/* Terms */}
        <div className="flex justify-center pt-0.5 pb-3 md:pt-1 md:pb-4">
          <button
            type="button"
            onClick={() => dispatch(modalOpened({ type: "terms" }))}
            className="text-xs leading-[15px] font-medium text-[#73696e] underline hover:text-[#21171c]"
          >
            Terms &amp; Conditions
          </button>
        </div>
      </div>
    </article>
  );
}

/** Round white merchant badge beside the desktop title; its initial when there is no logo. */
function MerchantCircle({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <span
      aria-hidden
      className="grid size-[52px] shrink-0 place-items-center overflow-hidden rounded-full bg-white text-xl font-bold text-[#e2136e] shadow"
    >
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt=""
          width={52}
          height={52}
          className="size-full object-contain p-1.5"
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
