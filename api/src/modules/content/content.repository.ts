import {
  ContentModel,
  type ContentKey,
  type ContentRecord,
  type ContentVersion,
} from "./content.model.js";

/** Versions kept for "Restore" (older ones are dropped). */
export const MAX_HISTORY = 50;

export class ContentRepository {
  findByKey(key: ContentKey): Promise<ContentRecord | null> {
    return ContentModel.findOne({ key }).lean<ContentRecord>().exec();
  }

  /**
   * Publishes a new current version. Optimistic concurrency: only succeeds if
   * the current version is still `expectedVersion` (two admins saving at once
   * can't silently overwrite each other). Returns null on conflict.
   */
  async publish(
    key: ContentKey,
    next: ContentVersion,
    expectedVersion: number | null,
    previous: ContentVersion | null,
  ): Promise<ContentRecord | null> {
    if (expectedVersion === null || !previous) {
      try {
        const doc = await ContentModel.create({ key, current: next, history: [] });
        return doc.toObject<ContentRecord>();
      } catch (error) {
        // Duplicate key = another admin created it first (conflict); anything else is a real error.
        if (typeof error === "object" && error !== null && "code" in error && error.code === 11000)
          return null;
        throw error;
      }
    }
    return ContentModel.findOneAndUpdate(
      { key, "current.version": expectedVersion },
      {
        $set: { current: next },
        // Newest first even after a restore (the replaced version can be older than others).
        $push: { history: { $each: [previous], $sort: { version: -1 }, $slice: MAX_HISTORY } },
      },
      { new: true },
    )
      .lean<ContentRecord>()
      .exec();
  }

  /**
   * Makes `nextCurrent` (an existing version from the history) the current one
   * and stores `history` as given. Only succeeds if the current version is still
   * `expectedVersion` and the target is still in the history; null on conflict.
   */
  activate(
    key: ContentKey,
    nextCurrent: ContentVersion,
    history: ContentVersion[],
    expectedVersion: number,
  ): Promise<ContentRecord | null> {
    return ContentModel.findOneAndUpdate(
      { key, "current.version": expectedVersion, "history.version": nextCurrent.version },
      { $set: { current: nextCurrent, history: history.slice(0, MAX_HISTORY) } },
      { new: true },
    )
      .lean<ContentRecord>()
      .exec();
  }
}
