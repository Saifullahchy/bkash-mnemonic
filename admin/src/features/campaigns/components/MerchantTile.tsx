/* eslint-disable @next/next/no-img-element -- uploaded logos come from the API/CDN host */
import { cn } from "@/lib/cn";

/** Merchant logo, or its initial on a tinted tile (grey once a campaign ended) — Figma "Logo": 44px, 12px radius. */
export function MerchantTile({
  name,
  logoUrl,
  muted,
  className,
}: {
  name: string;
  logoUrl: string | null;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl text-lg leading-[normal] font-extrabold",
        muted ? "bg-[#f1eef0] text-[#8e8589]" : "bg-[#fce7f0] text-[#e2136e]",
        className,
      )}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="" className="size-full object-cover" />
      ) : (
        (name.trim()[0]?.toUpperCase() ?? "?")
      )}
    </span>
  );
}
