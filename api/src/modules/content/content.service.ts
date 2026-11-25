import { Types } from "mongoose";
import { AppError, NotFoundError } from "../../core/errors/AppError.js";
import {
  richTextToPlain,
  sanitizeRichText,
  sectionsToHtml,
} from "../../core/security/htmlSanitizer.js";
import type { Clock } from "../../core/utils/clock.js";
import type { ActivityActor, ActivityService } from "../activity/activity.service.js";
import type { ContentVersion } from "./content.model.js";
import type { ContentRepository } from "./content.repository.js";

export interface TermsDto {
  title: string;
  summary: string;
  /** Sanitised HTML, safe to render. */
  html: string;
  version: number;
  updatedAt: string;
}

export interface TermsAdminDto extends TermsDto {
  updatedByName: string | null;
  restoredFrom: number | null;
  history: { version: number; title: string; savedAt: string; updatedByName: string | null }[];
}

export interface TermsInput {
  title: string;
  summary: string;
  html: string;
  /** Version the admin started editing from (conflict detection). */
  baseVersion: number | null;
}

export class ContentConflictError extends AppError {
  constructor() {
    super(
      "Someone else saved a newer version. Reload to see it before saving.",
      409,
      "CONTENT_CONFLICT",
    );
  }
}

const htmlOf = (v: ContentVersion) => v.html || sectionsToHtml(v.sections ?? []);

export class ContentService {
  constructor(
    private readonly content: ContentRepository,
    private readonly activity: ActivityService,
    private readonly clock: Clock,
  ) {}

  async getTerms(): Promise<TermsDto> {
    const record = await this.content.findByKey("terms");
    if (!record) throw new NotFoundError("Terms & Conditions");
    const { title, summary, version, savedAt } = record.current;
    return {
      title,
      summary,
      html: htmlOf(record.current),
      version,
      updatedAt: savedAt.toISOString(),
    };
  }

  /** Editor view: current version + restorable history (newest first). Null if never published. */
  async getTermsForAdmin(): Promise<TermsAdminDto | null> {
    const record = await this.content.findByKey("terms");
    if (!record) return null;
    const c = record.current;
    return {
      title: c.title,
      summary: c.summary,
      html: htmlOf(c),
      version: c.version,
      updatedAt: c.savedAt.toISOString(),
      updatedByName: c.updatedByName ?? null,
      restoredFrom: c.restoredFrom ?? null,
      history: record.history.map((h) => ({
        version: h.version,
        title: h.title,
        savedAt: h.savedAt.toISOString(),
        updatedByName: h.updatedByName ?? null,
      })),
    };
  }

  async saveTerms(
    input: TermsInput,
    actor: ActivityActor & { id: string },
  ): Promise<TermsAdminDto> {
    const html = sanitizeRichText(input.html);
    if (!richTextToPlain(html)) {
      throw new AppError("Terms content can't be empty", 400, "VALIDATION_ERROR", [
        { path: "html", message: "Write the terms first" },
      ]);
    }
    return this.publishVersion(
      { title: input.title, summary: input.summary, html, restoredFrom: null },
      input.baseVersion,
      actor,
    );
  }

  /**
   * Makes an older version current again — the same version (same number), not
   * a copy. The version it replaces moves into the history, so nothing is lost
   * and switching back is just another restore.
   */
  async restoreTerms(
    version: number,
    actor: ActivityActor & { id: string },
  ): Promise<TermsAdminDto> {
    const record = await this.content.findByKey("terms");
    const target = record?.history.find((h) => h.version === version);
    if (!record || !target) throw new NotFoundError(`Version ${version}`);

    const history = [...record.history.filter((h) => h.version !== version), record.current].sort(
      (a, b) => b.version - a.version,
    );
    const saved = await this.content.activate("terms", target, history, record.current.version);
    if (!saved) throw new ContentConflictError();

    await this.activity.record("terms_updated", actor, {
      meta: { version, restoredFrom: record.current.version },
    });
    return (await this.getTermsForAdmin())!;
  }

  private async publishVersion(
    data: Pick<ContentVersion, "title" | "summary" | "html" | "restoredFrom">,
    baseVersion: number | null,
    actor: ActivityActor & { id: string },
  ): Promise<TermsAdminDto> {
    const record = await this.content.findByKey("terms");
    const currentVersion = record?.current.version ?? null;
    if (baseVersion !== currentVersion) throw new ContentConflictError();

    // After a restore the current version can be older than some in the history,
    // so a new save always takes the next number after the highest one.
    const highest = Math.max(currentVersion ?? 0, ...(record?.history ?? []).map((h) => h.version));
    const next: ContentVersion = {
      ...data,
      sections: [],
      version: highest + 1,
      updatedBy: new Types.ObjectId(actor.id),
      updatedByName: actor.label,
      savedAt: this.clock.now(),
    };
    const saved = await this.content.publish(
      "terms",
      next,
      currentVersion,
      record?.current ?? null,
    );
    if (!saved) throw new ContentConflictError();

    await this.activity.record("terms_updated", actor, {
      meta: {
        version: next.version,
        ...(data.restoredFrom ? { restoredFrom: data.restoredFrom } : {}),
      },
    });
    return (await this.getTermsForAdmin())!;
  }
}
