import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStorage } from "./fileStorage.js";

/** Development driver: files on disk, served by the API at /uploads. */
export class LocalDiskStorage implements FileStorage {
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(directory: string, publicBaseUrl: string) {
    this.root = path.resolve(directory);
    this.baseUrl = publicBaseUrl.replace(/\/+$/, "");
  }

  /** Resolves a key inside the upload root, refusing anything that escapes it. */
  private pathFor(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(`${this.root}${path.sep}`))
      throw new Error(`Invalid storage key: ${key}`);
    return target;
  }

  async save(key: string, data: Buffer): Promise<string> {
    const target = this.pathFor(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: "wx" }); // never overwrite: keys are unique
    return `${this.baseUrl}/${key}`;
  }

  async delete(publicUrl: string): Promise<void> {
    if (!publicUrl.startsWith(`${this.baseUrl}/`)) return;
    try {
      await unlink(this.pathFor(publicUrl.slice(this.baseUrl.length + 1)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
