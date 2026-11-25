import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Label + control + hint/error — Figma "Field / …" (Admin Panel): 8px gaps,
 * 13px semibold #21181c label, bold pink "*" for required, 12px #8e8589 hint.
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  aside,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-[13px] leading-[normal] font-semibold text-[#21181c]"
        >
          {label}
          {required && (
            <span aria-hidden className="font-bold text-[#e2136e]">
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-xs leading-[normal] text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs leading-[normal] text-[#8e8589]">{hint}</p>
      )}
    </div>
  );
}
