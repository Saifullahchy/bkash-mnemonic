import type { Env } from "../../config/env.js";
import type { FileStorage } from "./fileStorage.js";
import { ImageKitStorage } from "./imageKitStorage.js";
import { LocalDiskStorage } from "./localDiskStorage.js";

/** The file storage selected by STORAGE_DRIVER (env validation guarantees the ImageKit key). */
export function createStorage(config: Env): FileStorage {
  if (config.STORAGE_DRIVER === "imagekit" && config.IMAGEKIT_PRIVATE_KEY) {
    return new ImageKitStorage({
      privateKey: config.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: config.IMAGEKIT_URL_ENDPOINT,
      folder: config.IMAGEKIT_FOLDER,
    });
  }
  return new LocalDiskStorage(config.UPLOAD_DIR, config.PUBLIC_UPLOAD_BASE_URL);
}
