import { imageSize } from "image-size";
import { ValidationError } from "../errors/AppError.js";

const ALLOWED = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;
export type AllowedImageType = keyof typeof ALLOWED;

export interface ImageRules {
  label: string;
  minWidth: number;
  minHeight: number;
  /** Allowed width/height ratio range. */
  aspect: [min: number, max: number];
}

export interface ValidatedImage {
  type: AllowedImageType;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Validates an upload by its actual bytes (not the client's declared MIME
 * type): must decode as PNG/JPEG/WebP and meet the size/shape rules.
 * SVG is intentionally not accepted (it can carry scripts).
 */
export function validateImage(buffer: Buffer, rules: ImageRules): ValidatedImage {
  let info: ReturnType<typeof imageSize>;
  try {
    info = imageSize(buffer);
  } catch {
    throw new ValidationError([{ path: "file", message: "File is not a valid image" }]);
  }

  const type = info.type === "jpeg" ? "jpg" : info.type;
  if (!type || !(type in ALLOWED)) {
    throw new ValidationError([
      { path: "file", message: `${rules.label} must be PNG, JPG or WebP` },
    ]);
  }
  const { width = 0, height = 0 } = info;
  if (width < rules.minWidth || height < rules.minHeight) {
    throw new ValidationError([
      {
        path: "file",
        message: `${rules.label} must be at least ${rules.minWidth}×${rules.minHeight}px`,
      },
    ]);
  }
  const ratio = width / height;
  if (ratio < rules.aspect[0] || ratio > rules.aspect[1]) {
    throw new ValidationError([
      { path: "file", message: `${rules.label} has the wrong shape (${width}×${height})` },
    ]);
  }
  const allowedType = type as AllowedImageType;
  return { type: allowedType, contentType: ALLOWED[allowedType], width, height };
}
