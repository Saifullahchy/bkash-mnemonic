/* eslint-disable @next/next/no-img-element -- local object URLs / API-hosted uploads */
import { Card } from "@/components/ui/Card";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { MerchantTile } from "../MerchantTile";

interface LivePreviewProps {
  merchantName: string;
  offerTitle: string;
  description: string;
  untilLabel: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  rewardTitle: string;
  rewardImageUrl: string | null;
  prizeTileUrl: string | null;
}

/**
 * Mobile offer card preview, updating as the admin types. Purely visual.
 * Figma "Live preview" (237:1071): 20px padding, 16px gap, "Mobile" chip, then an
 * offer card with an 130px banner, 12px content padding and 36px buttons.
 */
export function LivePreview(p: LivePreviewProps) {
  return (
    <Card className="flex flex-col gap-4 p-5 leading-[normal]">
      <div className="flex items-center justify-between">
        <h2 className="text-ink text-base font-bold">Live preview</h2>
        <span className="rounded-full bg-[#fce7f0] px-2.5 py-1 text-xs font-semibold text-[#e2136e]">
          Mobile
        </span>
      </div>

      <div
        aria-hidden
        className="border-line overflow-clip rounded-[18px] border bg-white shadow-[0_6px_18px_rgb(74_25_48/0.08)]"
      >
        {p.bannerUrl ? (
          <img src={p.bannerUrl} alt="" className="h-[130px] w-full object-cover" />
        ) : (
          <div
            className="flex h-[130px] flex-col items-center justify-center gap-1.5 text-xs font-semibold text-white/85"
            style={{
              backgroundImage:
                "linear-gradient(157.12deg, #4d082b 14.64%, #b70d57 53.54%, #ed3385 85.36%)",
            }}
          >
            <img src="/images/icons/img-26.svg" alt="" width={26} height={26} />
            Offer banner
          </div>
        )}

        <div className="flex flex-col gap-2.5 p-3">
          <div className="flex items-center gap-2.5">
            <MerchantTile
              name={p.merchantName || "M"}
              logoUrl={p.logoUrl}
              className="size-10 text-base"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <p className="text-subtle truncate text-xs font-bold">
                {p.merchantName || "Merchant"}
              </p>
              <p className="text-ink line-clamp-2 text-[13px] leading-[17px] font-semibold">
                {p.offerTitle || "Offer title"}
              </p>
            </div>
            {p.untilLabel && (
              <span className="shrink-0 rounded-full bg-[#fce7f0] px-2 py-[3px] text-[10px] font-medium text-[#e2136e]">
                {p.untilLabel}
              </span>
            )}
          </div>

          {p.description && (
            <p className="text-muted line-clamp-3 text-[11px] leading-4">{p.description}</p>
          )}

          <RewardBanner title={p.rewardTitle} imageUrl={p.rewardImageUrl} />

          <div className="flex gap-2 text-xs font-bold">
            <span className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#e2136e] text-white shadow-[0_4px_6px_rgb(74_25_48/0.18)]">
              <MaskIcon src="/images/icons/share-14.svg" size={14} />
              Share Offer
            </span>
            <span className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#e2136e] px-3.5 text-[#e2136e]">
              <MaskIcon src="/images/icons/copy-14.svg" size={14} />
              Copy Link
            </span>
          </div>
        </div>
      </div>

      <p className="text-subtle -mb-2 text-xs font-medium">Shared link page</p>
      <div
        aria-hidden
        className="border-line flex items-center gap-3.5 rounded-[18px] border bg-white p-3"
      >
        <PrizeTile imageUrl={p.prizeTileUrl} />
        <p className="text-ink min-w-0 text-sm leading-5 font-bold">
          You could win an
          <br />
          <span className="text-[#e2136e]">{p.rewardTitle || "Reward title"}</span>
        </p>
      </div>
    </Card>
  );
}

/** Same layout as the app's PrizeBanner (88px tall, prize right-aligned in an 84×75 slot). */
function RewardBanner({ title, imageUrl }: { title: string; imageUrl: string | null }) {
  return (
    <div className="relative flex h-[88px] flex-col items-start justify-center gap-1 overflow-hidden rounded-[14px] border-[1.5px] border-[#ffd633] bg-gradient-to-r from-[#4d082b] via-[#b80d57] via-55% to-[#ed3385] px-3 shadow-[inset_0_0_10px_0_rgb(255_214_51/0.55)]">
      <span className="text-[9px] font-bold tracking-[0.9px] text-[#ffd973]">TOP SHARER WINS</span>
      <span className="max-w-[calc(100%-96px)] truncate text-base font-extrabold text-white">
        {title || "Reward title"}
      </span>
      <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ffeda6] to-[#ffc74d] px-2.5 py-1 text-[10px] font-bold text-[#21181c]">
        🏆 Rank #1
      </span>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="absolute top-[5.5px] right-[9.85px] h-[74.52px] w-[84px] object-contain object-right"
        />
      )}
    </div>
  );
}

/** Same tile as the app's shared-link page: 72px orange square, 51px prize picture. */
function PrizeTile({ imageUrl }: { imageUrl: string | null }) {
  return (
    <span
      className="grid size-[72px] shrink-0 place-items-center rounded-[18px] text-3xl"
      style={{
        backgroundImage: "linear-gradient(135deg, #ffc794 7.14%, #f2804d 46.43%, #c74d2e 78.57%)",
      }}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="size-[51px] object-contain" /> : "🎁"}
    </span>
  );
}
