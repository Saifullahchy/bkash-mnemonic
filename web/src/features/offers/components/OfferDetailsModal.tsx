"use client";

import Image from "next/image";
import { ModalCloseButton } from "@/components/ui/Modal";
import { startShare } from "@/features/share/thunks";
import { useAppDispatch } from "@/store/hooks";
import { modalOpened } from "@/store/slices/uiSlice";
import type { Offer } from "../types";
import { OfferBanner } from "./OfferBanner";
import { PrizeBanner } from "./PrizeBanner";

interface OfferDetailsModalProps {
  titleId: string;
  offer: Offer;
  onClose: () => void;
}

/**
 * Offer details popup. Figma has no frame for this popup, so it is composed
 * from the file's existing parts: the "Bottom sheet" (Login/Terms: white, 20px
 * radius, Figma shadow), the offer card's banner, info and reward banner, the
 * Login popup's body text and 46px primary CTA. Long descriptions scroll inside
 * the sheet so it always fits the screen.
 */
export function OfferDetailsModal({ titleId, offer, onClose }: OfferDetailsModalProps) {
  const dispatch = useAppDispatch();

  return (
    <div className="relative rounded-[20px] bg-white shadow-[0_6px_18px_-6px_rgb(74_25_48/0.08)]">
      <ModalCloseButton onClick={onClose} />

      <div className="max-h-[calc(100dvh-96px)] [scrollbar-width:none] overflow-y-auto overscroll-contain rounded-[20px] [&::-webkit-scrollbar]:hidden">
        <div className="overflow-hidden rounded-t-[20px]">
          <OfferBanner
            offer={offer}
            sizes="343px"
            className="motion-safe:animate-banner-zoom aspect-[349/152]"
          />
        </div>

        <div className="flex flex-col gap-4 px-4 pt-4 pb-6">
          {/* Offer info (card styles) */}
          <div className="flex flex-col gap-1" {...stagger(0)}>
            <h2 id={titleId} className="text-[15px] leading-[21px] font-bold text-[#21171c]">
              {offer.title}
            </h2>
            <p className="text-xs leading-[1.4] text-[#5d5358]">{offer.subtitle}</p>
            <p className="mt-1 flex w-fit items-center gap-1.5 rounded-full bg-[#fce7f1] px-2.5 py-1 text-[10px] leading-[normal] font-semibold text-[#e2136e]">
              <CalendarIcon />
              {offer.validityLabel}
            </p>
          </div>

          {/* Details */}
          {offer.description && (
            <div className="flex flex-col gap-1.5" {...stagger(1)}>
              <h3 className="text-xs leading-[normal] font-bold text-[#21181c]">Offer details</h3>
              <p className="text-xs leading-[1.4] whitespace-pre-line text-[#5d5358]">
                {offer.description}
              </p>
            </div>
          )}

          <div {...stagger(2)}>
            <PrizeBanner reward={offer.reward} shine />
          </div>

          {/* Primary CTA (Login popup style) */}
          <div className="flex flex-col items-center gap-3" {...stagger(3)}>
            <button
              type="button"
              onClick={() => dispatch(startShare(offer.id))}
              className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#e2136e] px-4 text-sm leading-[normal] font-bold text-white shadow-[0_6px_18px_-6px_rgb(74_25_48/0.08)] transition-colors hover:bg-[#c70f60]"
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
            <button
              type="button"
              onClick={() =>
                dispatch(
                  modalOpened({
                    type: "terms",
                    returnTo: { type: "offerDetails", campaignId: offer.id },
                  }),
                )
              }
              className="text-xs leading-[15px] font-medium text-[#73696e] underline hover:text-[#21171c]"
            >
              Terms &amp; Conditions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Content blocks fade up one after another as the popup opens
 * (the `[data-stagger]` rule in globals.css applies the animation).
 */
function stagger(step: number) {
  return { "data-stagger": step, style: { animationDelay: `${120 + step * 70}ms` } };
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <rect x="1.5" y="2.25" width="9" height="8.25" rx="1.75" />
      <path d="M1.5 5h9M4 1.25v2M8 1.25v2" />
    </svg>
  );
}
