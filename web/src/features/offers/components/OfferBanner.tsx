import Image from "next/image";
import { cn } from "@/lib/cn";
import type { Offer } from "../types";

interface OfferBannerProps {
  offer: Pick<Offer, "bannerUrl" | "merchantName" | "subtitle">;
  sizes: string;
  /** Above-the-fold image: preload it (LCP). */
  priority?: boolean;
  /** Drift the image slightly as the banner scrolls through the screen (depth effect). */
  parallax?: boolean;
  className?: string;
}

/** 343×152 offer banner; a branded placeholder when no banner was uploaded yet. */
export function OfferBanner({ offer, sizes, priority, parallax, className }: OfferBannerProps) {
  return (
    <div className={cn("relative aspect-[343/152] overflow-clip bg-zinc-900", className)}>
      {offer.bannerUrl ? (
        <Image
          src={offer.bannerUrl}
          alt={`${offer.merchantName} offer banner`}
          fill
          sizes={sizes}
          preload={priority}
          // SVGs are not run through the image optimizer.
          unoptimized={offer.bannerUrl.endsWith(".svg")}
          className={cn("object-cover", parallax && "banner-parallax")}
        />
      ) : (
        <div className="from-brand-700 to-brand-400 flex size-full flex-col items-center justify-center bg-gradient-to-br px-6 text-center text-white">
          <span className="text-2xl font-extrabold tracking-tight">{offer.merchantName}</span>
          <span className="mt-1 text-sm text-white/85">{offer.subtitle}</span>
        </div>
      )}
    </div>
  );
}
