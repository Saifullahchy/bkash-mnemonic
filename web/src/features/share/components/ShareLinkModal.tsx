"use client";

import { Loader2, RotateCw } from "lucide-react";
import Image from "next/image";
import { ModalCloseButton } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import type { Offer } from "@/features/offers/types";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useGetShareLinkQuery } from "../api/shareApi";
import { useShareActions } from "../hooks/useShareActions";
import { toDisplayUrl } from "../lib/displayUrl";
import { CopiedCheck } from "./CopiedCheck";

interface ShareLinkModalProps {
  titleId: string;
  offer: Offer;
  onClose: () => void;
}

const icon = (src: string, size: number) => (
  <Image src={src} alt="" aria-hidden width={size} height={size} unoptimized className="shrink-0" />
);

/** "Share-link Card" (Figma node 233:1063). */
export function ShareLinkModal({ titleId, offer, onClose }: ShareLinkModalProps) {
  // Get-or-create the participant's personal link for this campaign.
  const { data: link, isFetching, error, refetch } = useGetShareLinkQuery(offer.id);
  const { copyLink, shareLink, copied, copyCount } = useShareActions(offer);
  const ready = Boolean(link) && !error;

  return (
    <div
      className="relative flex flex-col gap-5 rounded-[20px] px-4 py-8 text-white shadow-[0_6px_18px_-6px_rgb(74_25_48/0.08)]"
      style={{
        background: "linear-gradient(221deg, #e2136e 30.58%, hsl(333.88deg 100% 25%) 145.52%)",
      }}
    >
      {/* Figma: 33.5px above the card, 1.5px in from its right edge */}
      <ModalCloseButton onClick={onClose} className="-top-[33.5px] right-[1.5px]" />

      <span
        aria-hidden
        className="absolute top-3.5 right-[16.7px] grid size-[37.954px] place-items-center"
      >
        <Image
          src="/images/icons/gift.svg"
          alt=""
          width={32}
          height={32}
          unoptimized
          className="rotate-12"
        />
      </span>

      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="text-[17px] leading-[21px] font-semibold">
          Your Personal Share Link
        </h2>

        {/* Personal link */}
        <div className="flex h-11 items-center justify-between gap-2 rounded-xl bg-white px-3">
          {link && !error ? (
            <>
              <span
                className="min-w-0 flex-1 truncate text-xs leading-[normal] font-bold text-[#21181c]"
                title={link.url}
              >
                {toDisplayUrl(link.url)}
              </span>
              <button
                type="button"
                onClick={() => copyLink(link.url)}
                aria-label="Copy link"
                className="-m-1.5 grid size-7 place-items-center rounded-lg transition-colors hover:bg-[#fce7f1]"
              >
                {icon("/images/icons/copy-16.svg", 16)}
              </button>
            </>
          ) : (
            <span className="flex flex-1 items-center gap-2 text-xs text-[#5d5358]">
              {isFetching ? (
                <>
                  <Loader2 className="size-4 animate-spin text-[#e2136e]" aria-hidden />
                  Generating your link…
                </>
              ) : (
                "Link unavailable"
              )}
            </span>
          )}
        </div>

        {/*
          Figma "Copy success" row, below the link field. It takes no space until there
          is something to say, then slides open smoothly (height animates, nothing
          overshoots); its own top padding stands in for the 16px gap.
        */}
        <div
          aria-live="polite"
          className={cn(
            "-mt-4 grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
            copied || error ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="flex min-h-[18px] items-center pt-4">
              {error ? (
                <p className="flex items-center gap-2 text-[10px] leading-[normal] font-bold">
                  {getApiErrorMessage(error)}
                  {!isFetching && (
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      <RotateCw className="size-3" aria-hidden /> Retry
                    </button>
                  )}
                </p>
              ) : (
                // Kept rendered after `copied` ends so it fades out with the row.
                copyCount > 0 && (
                  <p
                    key={copyCount}
                    className="motion-safe:animate-soft-in flex items-center gap-1.5 text-[10px] leading-[normal] font-bold"
                  >
                    <CopiedCheck />
                    Copied! Your link is ready to share.
                  </p>
                )
              )}
            </div>
          </div>
        </div>

        {/* Link actions */}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => link && copyLink(link.url)}
            className="flex h-[50px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#e2136e] bg-white px-3 text-xs leading-[normal] font-bold text-[#e2136e] transition-[background-color,transform] duration-150 hover:bg-[#fff5f9] active:scale-[0.98] disabled:opacity-60"
          >
            {/* keyed so the swap replays on every copy without remounting the button */}
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
                  stroke="#e2136e"
                  className="size-4 place-items-center"
                />
              ) : (
                icon("/images/icons/copy-16.svg", 16)
              )}
              {copied ? "Copied!" : "Copy Link"}
            </span>
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => link && shareLink(link.url)}
            className="flex h-[50px] min-w-0 flex-1 items-center justify-center gap-4 rounded-2xl border border-white/24 px-3 py-1 text-xs leading-[normal] font-bold text-white shadow-[0_4px_8px_-2px_rgb(226_19_110/0.48)] transition-[filter] hover:brightness-105 disabled:opacity-60"
            style={{
              background:
                "radial-gradient(572.4px 180px at 50% -130px, rgb(255 255 255 / 0.3), rgb(255 255 255 / 0)), #ff0f78",
            }}
          >
            {icon("/images/icons/send-16.svg", 16)}
            Share Now
          </button>
        </div>

        <hr className="border-white/30" />
      </div>

      <p className="text-center text-xs leading-[1.4]">
        Anyone opening this link will be
        <br />
        counted toward your share progress.
      </p>
    </div>
  );
}
