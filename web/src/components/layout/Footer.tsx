import { BRAND } from "@/lib/constants";

/** Figma "Footer" (node 480:598). */
export function Footer() {
  return (
    <footer className="flex min-h-[82px] flex-col items-center gap-2.5 bg-[#e2136e] px-4 py-[22px] text-center text-[10px] leading-[1.4] text-white md:text-xs">
      <p>{BRAND.tagline}</p>
      <p className="whitespace-nowrap">
        © {BRAND.copyrightYear} {BRAND.copyrightOwner}. All rights reserved.
      </p>
    </footer>
  );
}
