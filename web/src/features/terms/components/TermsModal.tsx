"use client";

import { ModalCloseButton } from "@/components/ui/Modal";
import type { Terms } from "../types";

interface TermsModalProps {
  titleId: string;
  terms: Terms | null;
  onClose: () => void;
}

/**
 * Terms popup — Figma "Bottom sheet" (node 233:877): white 343px sheet, 20px
 * radius, 32/16/24 padding, 15px bold title and 10px body text in #5d5358.
 * Long terms scroll inside the sheet so it always fits the screen.
 */
export function TermsModal({ titleId, terms, onClose }: TermsModalProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-white px-4 pt-8 pb-6 text-[#5d5358] shadow-[0_6px_18px_-6px_rgb(74_25_48/0.08)]">
      <ModalCloseButton onClick={onClose} />
      <h2 id={titleId} className="text-[15px] leading-[1.4] font-bold">
        {terms?.title ?? "Terms & Conditions"}
      </h2>
      {terms ? (
        <div
          className="terms-content max-h-[calc(100dvh-240px)] [scrollbar-width:none] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden"
          // Safe: the API sanitises this HTML (allowlist of formatting tags, safe links only).
          dangerouslySetInnerHTML={{ __html: terms.html }}
        />
      ) : (
        <p className="text-[10px] leading-[1.4]">Terms &amp; Conditions will be published soon.</p>
      )}
    </div>
  );
}
