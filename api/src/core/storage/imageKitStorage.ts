import path from "node:path";
import { logger } from "../../config/logger.js";
import { AppError } from "../errors/AppError.js";
import type { FileStorage } from "./fileStorage.js";

const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const FILES_URL = "https://api.imagekit.io/v1/files";
const TIMEOUT_MS = 20_000;

export class ImageStorageError extends AppError {
  constructor(message = "Image storage is unavailable, please try again") {
    super(message, 502, "IMAGE_STORAGE_FAILED");
  }
}

export interface ImageKitOptions {
  /** Server-side only; never sent to a browser. */
  privateKey: string;
  /** e.g. https://ik.imagekit.io/yyzpkkigy */
  urlEndpoint: string;
  /** Folder in the media library that holds every upload, e.g. "offer-finder". */
  folder: string;
}

/**
 * ImageKit.io driver: files go to the media library and are served by ImageKit's
 * CDN. Only the public URL is stored in the database.
 */
export class ImageKitStorage implements FileStorage {
  private readonly authorization: string;
  private readonly endpoint: string;
  private readonly folder: string;

  constructor(options: ImageKitOptions) {
    this.authorization = `Basic ${Buffer.from(`${options.privateKey}:`).toString("base64")}`;
    this.endpoint = options.urlEndpoint.replace(/\/+$/, "");
    this.folder = options.folder.replace(/^\/+|\/+$/g, "");
  }

  async save(key: string, data: Buffer, contentType: string): Promise<string> {
    const target = path.posix.join("/", this.folder, key);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(data)], { type: contentType }));
    form.append("fileName", path.posix.basename(target));
    form.append("folder", path.posix.dirname(target));
    // Keys are already unique: keep the exact name and never overwrite.
    form.append("useUniqueFileName", "false");
    form.append("overwriteFile", "false");

    const response = await this.request(UPLOAD_URL, { method: "POST", body: form });
    const { filePath } = (await response.json()) as { filePath?: string };
    if (!filePath) throw new ImageStorageError();
    return `${this.endpoint}${filePath}`;
  }

  async delete(publicUrl: string): Promise<void> {
    if (!publicUrl.startsWith(`${this.endpoint}/`)) return;
    const filePath = publicUrl.slice(this.endpoint.length).split("?")[0] ?? "";
    // Only files this app uploaded: other folders of the account are never touched.
    if (!filePath.startsWith(path.posix.join("/", this.folder, "/"))) return;

    // Deleting needs ImageKit's file id; names end in a random part, so this finds exactly one.
    const url = new URL(FILES_URL);
    url.searchParams.set("searchQuery", `name = ${JSON.stringify(path.posix.basename(filePath))}`);
    const found = (await (await this.request(url)).json()) as {
      fileId?: string;
      filePath?: string;
    }[];
    const match = found.find((file) => file.filePath === filePath);
    if (!match?.fileId) return;
    await this.request(`${FILES_URL}/${encodeURIComponent(match.fileId)}`, { method: "DELETE" });
  }

  private async request(url: string | URL, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { Authorization: this.authorization },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      logger.error({ err: error }, "ImageKit request failed");
      throw new ImageStorageError();
    }
    if (response.ok) return response;

    const detail = await response.text().catch(() => "");
    logger.error(
      { status: response.status, detail: detail.slice(0, 500) },
      "ImageKit rejected a request",
    );
    throw new ImageStorageError(
      response.status === 401 || response.status === 403
        ? "ImageKit rejected the API key. Check IMAGEKIT_PRIVATE_KEY on the server."
        : undefined,
    );
  }
}
