import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    // Figma "Page header" (node 236:587): 28px extra-bold title, 14px description, 24px below.
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1 leading-[normal]">
        <h1 className="text-ink text-[28px] font-extrabold">{title}</h1>
        <p className="text-muted text-sm">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
