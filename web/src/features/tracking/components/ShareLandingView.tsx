import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { OfferBanner } from "@/features/offers/components/OfferBanner";
import type { ShareLanding } from "../types";
import { OpenBeacon } from "./OpenBeacon";

const svg = (src: string, size: number, className?: string) => (
  <Image
    src={src}
    alt=""
    aria-hidden
    width={size}
    height={size}
    unoptimized
    className={className}
  />
);

/**
 * What a friend sees after tapping a shared link — Figma "C — One ticket
 * (offer + reward joined)" (node 368:629): one ticket with a pink-to-orange
 * border holding the offer, a "Share & Win" divider and the prize + CTA.
 */
export function ShareLandingView({ landing }: { landing: ShareLanding }) {
  const { offer, openToken, code } = landing;
  const ended = offer.status === "ended";

  return (
    <Container className="px-4 pt-14 pb-8 md:max-w-[448px] md:px-4">
      {/* Ticket: 1.5px gradient border (Figma renders pink top-left → orange bottom-right). */}
      <article
        aria-labelledby="shared-offer-title"
        className="flex flex-col gap-3.5 overflow-clip rounded-[28px] border-[1.5px] border-transparent p-2"
        style={{
          background:
            "linear-gradient(#fff, #fff) padding-box, linear-gradient(150deg, #e2136e 0%, #f36f8f 45%, #ffa24d 100%) border-box",
        }}
      >
        {/* Ticket head */}
        <p className="flex items-center gap-2.5 px-1 pt-1.5 text-[13px] leading-[normal] font-bold text-[#21181c]">
          {svg("/images/shared/avatar.svg", 28, "shrink-0")}
          Your friend shared this offer with you
        </p>

        {/* Section 1 — Offer */}
        <section className="flex flex-col gap-3.5">
          <OfferBanner
            offer={offer}
            sizes="(min-width: 480px) 400px, calc(100vw - 51px)"
            priority
            className="aspect-auto h-[140px] rounded-[20px] shadow-[0_8px_18px_-6px_rgb(226_19_110/0.28)]"
          />

          <div className="flex flex-col gap-3 px-1 pb-1">
            <div className="flex items-center gap-2.5">
              <span className="grid h-[47px] w-[46px] shrink-0 place-items-center rounded-lg bg-[#fff4f8]">
                <Image
                  src={offer.logoUrl ?? "/images/shared/merchant-placeholder.webp"}
                  alt={`${offer.merchantName} logo`}
                  width={42}
                  height={42}
                  unoptimized={!offer.logoUrl}
                  className="size-[42px] rounded-[7px] object-cover"
                />
              </span>
              <div className="flex min-w-0 flex-col items-start gap-2">
                <h1
                  id="shared-offer-title"
                  className="max-w-full truncate text-[13px] leading-[normal] font-bold text-[#21181c]"
                >
                  {offer.subtitle}
                </h1>
                {offer.validityLabel && (
                  <p className="flex items-center gap-1 rounded bg-[#ffe9f1] px-2 py-1 text-[10px] leading-[normal] font-medium text-[#e2136e]">
                    {svg("/images/shared/clock.svg", 12, "shrink-0")}
                    {offer.validityLabel}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/"
              className="text-center text-xs leading-[normal] font-medium text-[#b70d57] underline hover:text-[#e2136e]"
            >
              Know more on offer finder
            </Link>
          </div>
        </section>

        {/* Divider */}
        <div aria-hidden className="flex items-center gap-2.5 px-1">
          <DashedLine />
          <span className="flex shrink-0 items-center gap-1.5 rounded-[50px] bg-gradient-to-r from-[#e2136e] to-[#ff5c9e] px-3 py-[5px] text-[10px] leading-[normal] font-bold tracking-[0.6px] text-white shadow-[0_3px_8px_-2px_rgb(226_19_110/0.35)]">
            {svg("/images/shared/star-10.svg", 10)}
            SHARE &amp; WIN
          </span>
          <DashedLine />
        </div>

        {/* Section 2 — Share & win */}
        <section className="flex flex-col gap-3.5 px-1 pb-1.5">
          {ended ? (
            <p className="rounded-2xl bg-[#f7f5f6] px-4 py-3 text-sm leading-[1.4] font-medium text-[#5c5459]">
              This campaign has ended — new offers are waiting on our website.
            </p>
          ) : (
            <div className="flex items-center gap-3.5">
              <PrizeTile imageUrl={offer.reward.tileImageUrl} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-lg leading-6 font-bold text-[#21181c]">
                  You could win an
                  <br />
                  <span className="text-[#e2136e]">{offer.reward.title}</span>
                </p>
                <p className="text-xs leading-[17px] text-[#5c5459]">
                  Share this offer too. More shares, better chance.
                </p>
              </div>
            </div>
          )}

          <Link
            href="/"
            className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-white/24 px-4 text-[15px] leading-[normal] font-bold text-white shadow-[0_4px_8px_-2px_rgb(226_19_110/0.48)] transition-[filter] hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#e2136e] focus-visible:ring-offset-2 focus-visible:outline-none"
            style={{
              background:
                "radial-gradient(366.18px 60.26px at 50% -8.26px, rgb(255 255 255 / 0.3), rgb(255 255 255 / 0)), #e2136e",
            }}
          >
            {ended ? "See live offers" : "Visit Our Website"}
            <span aria-hidden>↗</span>
          </Link>
          <p className="text-center text-[11px] leading-[normal] text-[#5c5459]">
            Sharing starts on our website.
          </p>
        </section>
      </article>

      {openToken && <OpenBeacon code={code} token={openToken} />}
    </Container>
  );
}

/** Figma "Line": 1.5px dashes in 40% pink. */
function DashedLine() {
  return (
    <span
      className="h-[1.5px] min-w-0 flex-1"
      style={{
        backgroundImage:
          "repeating-linear-gradient(90deg, rgb(226 19 110 / 0.4) 0 4.16px, transparent 4.16px 8.32px)",
      }}
    />
  );
}

/** Figma "Prize image wrap": 72px orange tile, two stars, the prize picture centred. */
function PrizeTile({ imageUrl }: { imageUrl: string | null }) {
  return (
    <div className="relative size-[72px] shrink-0">
      <div
        className="absolute inset-0 rounded-[18px] shadow-[0_8px_16px_-4px_rgb(242_115_51/0.4)]"
        style={{
          backgroundImage: "linear-gradient(135deg, #ffc794 7.14%, #f2804d 46.43%, #c74d2e 78.57%)",
        }}
      />
      {imageUrl ? (
        <div className="absolute top-[10.5px] left-[10.5px] size-[51px]">
          <Image src={imageUrl} alt="" fill sizes="51px" unoptimized className="object-contain" />
        </div>
      ) : (
        <span aria-hidden className="absolute inset-0 grid place-items-center text-3xl">
          🎁
        </span>
      )}
      {svg("/images/shared/star-19.svg", 19.44, "absolute top-[-7.2px] left-[56.16px]")}
      {svg("/images/shared/star-10b.svg", 10.08, "absolute top-[7.2px] left-[7.2px]")}
    </div>
  );
}
