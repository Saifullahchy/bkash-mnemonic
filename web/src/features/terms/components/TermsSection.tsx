"use client";

import Image from "next/image";
import { useAppDispatch } from "@/store/hooks";
import { modalOpened } from "@/store/slices/uiSlice";

/**
 * Full-width "Terms and conditions" row above the footer (Figma node 480:592).
 * Figma strokes sit inside the 91px frame, so padding is 18px minus the 1px border.
 */
export function TermsSection({ title, summary }: { title: string; summary: string }) {
  const dispatch = useAppDispatch();
  return (
    <section>
      <button
        type="button"
        onClick={() => dispatch(modalOpened({ type: "terms" }))}
        className="group flex min-h-[91px] w-full flex-col gap-2 border-y border-[#eae3e6] bg-white px-4 py-[17px] text-left md:px-0"
      >
        <span className="flex w-full items-center justify-between text-sm leading-[normal] font-extrabold text-[#21181c] md:mx-auto md:max-w-(--page-width) md:px-6 md:text-base">
          {title}
          <Image
            src="/images/icons/chevron-right.svg"
            alt=""
            aria-hidden
            width={16}
            height={16}
            unoptimized
            className="transition-transform group-hover:translate-x-0.5"
          />
        </span>
        <span className="text-[10px] leading-[1.5] text-[#8e8589] md:mx-auto md:w-full md:max-w-(--page-width) md:px-6 md:text-sm">
          {summary}
        </span>
      </button>
    </section>
  );
}
