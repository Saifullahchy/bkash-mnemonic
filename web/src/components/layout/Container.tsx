import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page gutter; on desktop (md+) it also limits content to --page-width, centered. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full px-4 md:max-w-(--page-width) md:px-6", className)}>
      {children}
    </div>
  );
}
