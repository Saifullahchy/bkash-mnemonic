import type { MediaKind } from "../types";

/** Same rules as the API (MEDIA_RULES); checked in the browser for instant feedback. */
export const MEDIA_RULES: Record<
  MediaKind,
  {
    label: string;
    minWidth: number;
    minHeight: number;
    aspect: [number, number];
    maxBytes: number;
    hint: string;
  }
> = {
  banner: {
    label: "Offer banner",
    minWidth: 343,
    minHeight: 152,
    aspect: [2.0, 2.6],
    maxBytes: 2 * 1024 * 1024,
    hint: "343 × 152 px · PNG, JPG or WebP",
  },
  "reward-banner": {
    label: "Reward banner image",
    minWidth: 50,
    minHeight: 50,
    aspect: [0.4, 2.2],
    maxBytes: 1024 * 1024,
    hint: "84 × 75 px · PNG, JPG or WebP",
  },
  "prize-tile": {
    label: "Prize tile image",
    minWidth: 50,
    minHeight: 50,
    aspect: [0.4, 2.2],
    maxBytes: 1024 * 1024,
    hint: "51 × 51 px · PNG, JPG or WebP",
  },
};

const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Resolves to an error message, or null if the file looks acceptable. */
export async function checkImage(file: File, kind: MediaKind): Promise<string | null> {
  const rules = MEDIA_RULES[kind];
  if (!TYPES.includes(file.type)) return `${rules.label} must be PNG, JPG or WebP`;
  if (file.size > rules.maxBytes)
    return `${rules.label} must be under ${rules.maxBytes / 1024 / 1024}MB`;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();
    if (width < rules.minWidth || height < rules.minHeight) {
      return `${rules.label} must be at least ${rules.minWidth}×${rules.minHeight}px`;
    }
    const ratio = width / height;
    if (ratio < rules.aspect[0] || ratio > rules.aspect[1])
      return `${rules.label} has the wrong shape (${width}×${height})`;
  } catch {
    return "This file isn't a readable image";
  }
  return null;
}
