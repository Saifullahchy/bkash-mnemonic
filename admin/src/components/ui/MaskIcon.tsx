import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * A Figma SVG icon painted with `currentColor` (CSS mask), so one file works
 * in any state colour — e.g. grey nav icons that turn white when active.
 */
export function MaskIcon({
  src,
  size = 20,
  className,
}: {
  src: string;
  size?: number;
  className?: string;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    maskImage: `url(${src})`,
    WebkitMaskImage: `url(${src})`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };
  return (
    <span aria-hidden className={cn("inline-block shrink-0 bg-current", className)} style={style} />
  );
}
