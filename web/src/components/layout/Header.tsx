import Link from "next/link";
import { AuthButton } from "@/features/auth/components/AuthButton";
import { BRAND } from "@/lib/constants";

/**
 * Figma "Frame 1948759968" (node 480:582): 345×40 row, 17px left / 13px right.
 * The 24px gap below it is page padding (pt-6), not header padding. It scrolls
 * away with the page (not sticky).
 */
export function Header({ minimal = false }: { minimal?: boolean }) {
  return (
    <header>
      {minimal ? (
        // Shared-link page (Figma "Top nav", 368:652): brand only, 12px top / 4px bottom.
        <div className="box-content flex h-6 items-center pt-3 pr-[13px] pb-1 pl-[17px] md:mx-auto md:box-border md:h-auto md:max-w-(--page-width) md:px-6">
          <Link href="/" className="text-xl leading-6 font-semibold text-[#242424] md:text-2xl">
            {BRAND.name}
          </Link>
        </div>
      ) : (
        <div className="box-content flex h-10 items-center justify-between pt-[15px] pr-[13px] pl-[17px] md:mx-auto md:box-border md:h-[55px] md:max-w-(--page-width) md:px-6">
          <Link href="/" className="text-xl leading-6 font-semibold text-[#242424] md:text-2xl">
            {BRAND.name}
          </Link>
          <AuthButton />
        </div>
      )}
    </header>
  );
}
