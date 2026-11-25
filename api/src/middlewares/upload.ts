import multer from "multer";
import type { RequestHandler } from "express";

/**
 * Single in-memory file upload (field "file"). Files are small images that are
 * validated by content and then handed to FileStorage, so nothing touches disk
 * before validation.
 */
export function singleImageUpload(maxBytes: number): RequestHandler {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 0, parts: 2 },
  }).single("file");
}
