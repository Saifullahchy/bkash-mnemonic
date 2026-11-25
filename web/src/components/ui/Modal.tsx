"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element that names the dialog (its title). */
  labelledBy: string;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible modal built on the native <dialog> element: it gives us the top
 * layer, focus trapping, ESC-to-close and inert background for free.
 * Content is only mounted while open so forms reset between openings.
 */
export function Modal({ open, onClose, labelledBy, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      onClose={onClose}
      // A click whose target is the <dialog> itself landed on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        // Figma popups are 343px wide on a 375px screen (16px sides).
        "m-auto w-[calc(100%-2rem)] max-w-[343px] overflow-visible bg-transparent p-0",
        className,
      )}
    >
      {open && <div className="motion-safe:animate-sheet-in relative">{children}</div>}
    </dialog>
  );
}

/**
 * Close button shared by every popup (Figma "cancel-01"): 29px white pill
 * (radius 40px), 4px padding, 12px X icon centred. Sits above the sheet's
 * top-right corner; pass `className` where a Figma frame places it differently.
 */
export function ModalCloseButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={cn(
        "absolute -top-[35px] right-0 z-10 box-border flex size-[29px] items-center justify-center gap-2.5 rounded-[40px] bg-white p-1 focus-visible:ring-2 focus-visible:ring-[#e2136e] focus-visible:outline-none",
        className,
      )}
    >
      {/*
        The X is drawn on the full 29px box, centred at 14.5, so it is optically centred
        at any pixel density (a 12px icon would land on a half pixel: (29 - 12) / 2 = 8.5).
        Same lines as the design icon: 10 units long, 1.5 stroke, round caps, #171717.
      */}
      <svg
        aria-hidden
        viewBox="0 0 29 29"
        fill="none"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <path
          d="M19.5 9.5L9.5 19.5M9.5 9.5L19.5 19.5"
          stroke="#171717"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
