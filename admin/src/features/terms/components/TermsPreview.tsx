import { MaskIcon } from "@/components/ui/MaskIcon";
import { cn } from "@/lib/cn";

/**
 * How the Terms pop-up looks on the offer site (mobile), using the same
 * rich-text styles.
 * - compact: Figma "Phone stage" (240:665): 420px pink stage dimmed 45%, a 292px
 *   white sheet (20px radius, 16px padding, 320px tall) with the 29px close above.
 * - full: the real 343px pop-up for the Preview dialog.
 */
export function TermsPreview({
  title,
  html,
  compact,
}: {
  title: string;
  html: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-clip",
        compact ? "h-[420px] rounded-2xl px-5" : "rounded-2xl px-6 pt-20 pb-12",
      )}
      style={{ backgroundImage: "linear-gradient(128.33deg, #e2136e 14.64%, #800038 85.36%)" }}
    >
      <span aria-hidden className="absolute inset-0 bg-black/45" />
      <div
        className={cn(
          "relative flex w-full flex-col items-end gap-2.5",
          compact ? "max-w-[292px]" : "max-w-[343px]",
        )}
      >
        <span aria-hidden className="grid size-[29px] place-items-center rounded-full bg-white">
          <MaskIcon src="/images/icons/close-12.svg" size={12} className="text-ink" />
        </span>
        <div
          className={cn(
            "flex w-full flex-col overflow-clip bg-white text-[#5d5358]",
            compact
              ? "h-80 gap-2.5 rounded-[20px] p-4"
              : "gap-4 rounded-[20px] px-4 pt-8 pb-6 shadow-[0_6px_18px_-6px_rgb(74_25_48/0.08)]",
          )}
        >
          <p className="text-[15px] leading-[normal] font-bold">{title || "Terms & Conditions"}</p>
          <div
            className={cn(
              "terms-preview text-[10px]",
              compact
                ? "min-h-0 flex-1 overflow-hidden"
                : "scrollbar-pink max-h-[60vh] overflow-y-auto",
            )}
            // Preview of the editor's own HTML; the API sanitises it again on save.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
