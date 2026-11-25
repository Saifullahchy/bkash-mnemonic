import Image from "next/image";
import { cn } from "@/lib/cn";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

const chevron = (dir: "left" | "right") => (
  <Image
    src={`/images/icons/chevron-${dir}-16.svg`}
    alt=""
    aria-hidden
    width={16}
    height={16}
    unoptimized
  />
);

/** "‹ 1 2 3 … 19,007 ›" with ellipses — Figma "Pages": 36px buttons, 10px radius, 8px gap. */
export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  const pages = buildPages(page, pageCount);
  const base =
    "grid size-9 place-items-center rounded-[10px] border text-[13px] leading-[normal] font-bold transition";
  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={cn(base, "border-line hover:bg-canvas bg-white disabled:opacity-40")}
      >
        {chevron("left")}
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className={cn(base, "border-line text-subtle bg-white")}>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? "page" : undefined}
            onClick={() => onChange(p)}
            className={cn(
              base,
              p === page
                ? "border-[#e2136e] bg-[#e2136e] text-white"
                : "border-line text-ink hover:bg-canvas bg-white",
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className={cn(base, "border-line hover:bg-canvas bg-white disabled:opacity-40")}
      >
        {chevron("right")}
      </button>
    </nav>
  );
}

function buildPages(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < count - 1) pages.push("…");
  pages.push(count);
  return pages;
}
