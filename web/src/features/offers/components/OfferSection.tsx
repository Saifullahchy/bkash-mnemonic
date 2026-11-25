import { Reveal } from "@/components/motion/Reveal";
import type { Offer } from "../types";
import { OfferCard } from "./OfferCard";

export function OfferSection({ offers }: { offers: Offer[] }) {
  return (
    <section aria-labelledby="share-to-win-title" className="space-y-6">
      {/* Figma "Frame 37" (node 480:627) */}
      <div className="motion-safe:animate-fade-up flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2
            id="share-to-win-title"
            className="text-xl leading-7 font-bold text-[#242424] md:text-2xl"
          >
            Share to win
          </h2>
          <p className="text-xs leading-5 text-[#313131] md:text-sm">
            Pick an offer your friends will love.
          </p>
        </div>
        <span className="flex h-7 shrink-0 items-center gap-2 rounded-[50px] border border-[rgb(226_19_110/0.3)] bg-white px-2 text-xs leading-[normal] font-bold whitespace-nowrap text-[#e2136e]">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#e2136e] opacity-50" />
            <span className="relative inline-flex size-2 rounded-full bg-[#e2136e]" />
          </span>
          {offers.length} live {offers.length === 1 ? "offer" : "offers"}
        </span>
      </div>

      {offers.length === 0 ? (
        <p className="border-line text-muted rounded-2xl border border-dashed p-8 text-center text-sm md:p-14">
          No live offers right now. Check back soon!
        </p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 md:gap-8">
          {offers.map((offer, index) =>
            // The first two cards are there as soon as the page loads (a CSS-only fade that
            // never waits for scrolling); later cards are revealed as they come into view.
            index < 2 ? (
              <div
                key={offer.id}
                className="motion-safe:animate-fade-up h-full min-w-0"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <OfferCard offer={offer} priority />
              </div>
            ) : (
              <Reveal key={offer.id} delay={(index % 2) * 90} className="h-full min-w-0">
                <OfferCard offer={offer} />
              </Reveal>
            ),
          )}
        </div>
      )}
    </section>
  );
}
