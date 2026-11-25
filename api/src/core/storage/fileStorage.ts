/**
 * Where uploaded files live. Services depend on this interface only, so drivers
 * (local disk, ImageKit — see createStorage) swap without touching business logic.
 */
export interface FileStorage {
  /** Stores the bytes under `key` and returns the public URL. */
  save(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Deletes a file previously returned by `save` (no-op for foreign URLs). */
  delete(publicUrl: string): Promise<void>;
}
