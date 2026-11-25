"use client";

/* eslint-disable @next/next/no-img-element -- local object URLs / API-hosted uploads */
import { RefreshCw } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { cn } from "@/lib/cn";
import { checkImage, MEDIA_RULES } from "../../lib/imageCheck";
import type { MediaKind } from "../../types";

interface MediaDropzoneProps {
  kind: MediaKind;
  label: string;
  /** Current image (pending local preview or uploaded URL). */
  previewUrl: string | null;
  pending: boolean;
  disabled?: boolean;
  onSelect: (file: File) => void;
}

/** Dashed "Click to upload or drag & drop" zone; validates before accepting a file. */
export function MediaDropzone({
  kind,
  label,
  previewUrl,
  pending,
  disabled,
  onSelect,
}: MediaDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const rules = MEDIA_RULES[kind];

  const accept = async (file: File | undefined) => {
    if (!file) return;
    const problem = await checkImage(file, kind);
    setError(problem);
    if (!problem) onSelect(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) void accept(event.dataTransfer.files[0]);
  };

  return (
    // Figma "Upload / …": 13px label, 8px gap, 132px dashed pink dropzone (14px radius).
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-ink text-[13px] leading-[normal] font-semibold">
        {label}
      </label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex h-[132px] flex-col items-center justify-center overflow-hidden rounded-[14px] border border-dashed border-[#e2136e] text-center transition-colors",
          dragging ? "bg-[#fce7f0]" : "bg-[#f7f5f6]",
          error && "border-red-400",
        )}
      >
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className={cn("size-full object-contain", kind !== "banner" && "p-4")}
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="text-ink absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold shadow"
            >
              <RefreshCw className="size-3" aria-hidden /> Replace
            </button>
            {pending && (
              <span className="bg-brand-500 absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">
                Uploads on save
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-2 px-4 leading-[normal]"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#fce7f0] text-[#e2136e]">
              <MaskIcon src="/images/icons/upload.svg" size={18} />
            </span>
            <span className="flex gap-1 text-[13px]">
              <span className="font-semibold text-[#e2136e]">Click to upload</span>
              <span className="text-muted">or drag &amp; drop</span>
            </span>
            <span className="text-subtle text-xs">{rules.hint}</span>
          </button>
        )}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            void accept(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
