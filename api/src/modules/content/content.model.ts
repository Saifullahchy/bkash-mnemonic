import { Schema, model, type Types } from "mongoose";

export const CONTENT_KEYS = ["terms"] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

export interface ContentSection {
  heading: string;
  body: string;
}

export interface ContentVersion {
  version: number;
  title: string;
  summary: string;
  /** Legacy structured content (before rich text); kept for old versions. */
  sections: ContentSection[];
  /** Sanitised rich-text HTML (core/security/htmlSanitizer.ts). */
  html: string;
  /** Set when this version was created by restoring an older one. */
  restoredFrom: number | null;
  updatedBy: Types.ObjectId | null;
  updatedByName: string | null;
  savedAt: Date;
}

export interface Content {
  key: ContentKey;
  current: ContentVersion;
  history: ContentVersion[];
}

const sectionSchema = new Schema<ContentSection>(
  {
    heading: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { _id: false },
);

const contentVersionSchema = new Schema<ContentVersion>(
  {
    version: { type: Number, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    /** Short text shown on the home page (max 160 chars in the admin design). */
    summary: { type: String, required: true, trim: true, maxlength: 160 },
    sections: { type: [sectionSchema], default: [] },
    html: { type: String, default: "", maxlength: 50_000 },
    restoredFrom: { type: Number, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    updatedByName: { type: String, default: null },
    savedAt: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * Admin-editable site content (Terms & Conditions). `current` is what the site
 * shows; `history` keeps previous versions so an admin can restore one.
 */
const contentSchema = new Schema<Content>(
  {
    key: { type: String, enum: CONTENT_KEYS, required: true },
    current: { type: contentVersionSchema, required: true },
    history: { type: [contentVersionSchema], default: [] },
  },
  { timestamps: true },
);

contentSchema.index({ key: 1 }, { unique: true });

export type ContentRecord = Content & { _id: Types.ObjectId };

export const ContentModel = model<Content>("Content", contentSchema);
