import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    // Figma panels: white, 1px #eae3e6, 18px radius, soft shadow.
    <div className={cn("border-line shadow-card rounded-[18px] border bg-white", className)}>
      {children}
    </div>
  );
}

/**
 * Titled form section — Figma "Section / …" (New Campaign): 24px padding,
 * 16px bold title, 13px subtitle, 20px down to the content.
 */
export function SectionCard({
  title,
  description,
  aside,
  children,
  className,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <PanelTitle title={title} description={description} size="md" />
        {aside}
      </div>
      {children}
    </Card>
  );
}

/** Figma panel heading: bold title (18px dashboard, 16px forms), 13px grey subtitle, 2px apart. */
export function PanelTitle({
  title,
  description,
  size = "lg",
}: {
  title: string;
  description?: string;
  size?: "lg" | "md";
}) {
  return (
    <div className="flex flex-col gap-0.5 leading-[normal]">
      <h2 className={cn("text-ink font-bold", size === "lg" ? "text-lg" : "text-base")}>{title}</h2>
      {description && <p className="text-subtle text-[13px]">{description}</p>}
    </div>
  );
}
