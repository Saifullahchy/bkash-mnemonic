import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendSuccess } from "../../../core/http/apiResponse.js";
import { setNoStore } from "../../../core/http/cache.js";
import { objectIdSchema } from "../../../core/http/schemas.js";
import { currentAdmin, type AdminAuthMiddleware } from "../../../middlewares/adminAuth.js";
import { createRateLimiter } from "../../../middlewares/rateLimiter.js";
import { validate, validated } from "../../../middlewares/validate.js";
import type { RouterConfig } from "../../../routes/routerConfig.js";
import {
  EXPORT_TYPES,
  PARTICIPANT_COLUMNS,
  type ExportFilters,
  type ExportType,
} from "./exports.datasets.js";
import type { ExportsService } from "./exports.service.js";
import type { ReportService } from "./report.service.js";
import { REPORT_DATASETS, REPORT_FREQUENCIES } from "./reportSchedule.model.js";

export const downloadSchema = {
  params: z.object({ type: z.enum(EXPORT_TYPES) }),
  query: z
    .object({
      campaignId: objectIdSchema.optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .strict()
    .refine((q) => !q.from || !q.to || q.to > q.from, {
      message: "'to' must be after 'from'",
      path: ["to"],
    }),
};
/** "a,b,c" → ["a","b","c"] (query strings carry lists comma-separated). */
const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((v) => [
      ...new Set(
        v
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.enum(values)).min(1));

/** "Export to Excel" modal: several datasets in one workbook, optional column pick. */
export const customSchema = {
  query: z
    .object({
      datasets: csv(EXPORT_TYPES),
      columns: csv(PARTICIPANT_COLUMNS).optional(),
      campaignId: objectIdSchema.optional(),
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .strict()
    .refine((q) => !q.from || !q.to || q.to > q.from, {
      message: "'to' must be after 'from'",
      path: ["to"],
    }),
};
const historyIdSchema = { params: z.object({ id: objectIdSchema }) };
export const scheduleSchema = {
  body: z
    .object({
      enabled: z.boolean(),
      frequency: z.enum(REPORT_FREQUENCIES),
      datasets: z
        .array(z.enum(REPORT_DATASETS))
        .min(1, "Pick at least one dataset")
        .max(REPORT_DATASETS.length),
      recipients: z.array(z.email("Enter valid email addresses")).max(10, "At most 10 recipients"),
    })
    .strict(),
};

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class ExportsController {
  constructor(
    private readonly exports: ExportsService,
    private readonly reports: ReportService,
  ) {}

  private async streamFile(
    req: Request,
    res: Response,
    types: ExportType[],
    filters: ExportFilters,
  ) {
    const admin = currentAdmin(req);
    const filename = await this.exports.filenameFor(
      types.length === 1 ? types[0]! : "custom",
      filters,
    );
    res.setHeader("Content-Type", XLSX);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Request-Id");
    try {
      await this.exports.stream(
        types,
        filters,
        res,
        { kind: "admin", id: admin.id, label: admin.name },
        filename,
      );
      res.end();
    } catch (error) {
      // Headers are already sent, so the only safe signal is aborting the download.
      req.log.error({ err: error, types }, "Export failed mid-stream");
      res.destroy(error instanceof Error ? error : undefined);
    }
  }

  download = async (req: Request, res: Response): Promise<void> => {
    const { params, query } = validated(req, downloadSchema);
    await this.streamFile(req, res, [params.type], {
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });
  };

  custom = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, customSchema);
    await this.streamFile(req, res, query.datasets, {
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.columns ? { columns: query.columns } : {}),
    });
  };

  redownload = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, historyIdSchema);
    const { types, filters } = await this.exports.historyFilters(params.id);
    await this.streamFile(req, res, types, filters);
  };

  summary = async (_req: Request, res: Response): Promise<void> => {
    setNoStore(res);
    sendSuccess(res, await this.exports.summary());
  };

  history = async (_req: Request, res: Response): Promise<void> => {
    setNoStore(res);
    sendSuccess(res, await this.exports.history(20));
  };

  getSchedule = async (_req: Request, res: Response): Promise<void> => {
    setNoStore(res);
    sendSuccess(res, await this.reports.get());
  };

  saveSchedule = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, scheduleSchema);
    sendSuccess(res, await this.reports.save(body, currentAdmin(req).name));
  };

  sendNow = async (_req: Request, res: Response): Promise<void> => {
    sendSuccess(res, await this.reports.sendNow());
  };
}

/**
 * Mounted at /v1/admin/exports. Exports contain phone numbers (personal data),
 * so downloads and report settings are limited to the "admin" role.
 */
export function createExportsRouter(
  controller: ExportsController,
  auth: AdminAuthMiddleware,
  config: RouterConfig,
): Router {
  const router = Router();
  const adminOnly = auth.requireRole("admin");
  const downloadLimit = createRateLimiter({
    name: "admin-export",
    enabled: config.rateLimitEnabled,
    store: config.rateLimitStore,
    windowMs: 60_000,
    limit: 10,
    keyGenerator: (req) => req.admin?.id ?? req.ip ?? "unknown",
  });

  router.get("/summary", controller.summary);
  router.get("/history", controller.history);
  router.get(
    "/history/:id/download",
    adminOnly,
    downloadLimit,
    validate(historyIdSchema),
    controller.redownload,
  );
  router.get("/schedule", controller.getSchedule);
  router.put("/schedule", adminOnly, validate(scheduleSchema), controller.saveSchedule);
  router.post("/schedule/send-now", adminOnly, downloadLimit, controller.sendNow);
  router.get("/custom", adminOnly, downloadLimit, validate(customSchema), controller.custom);
  router.get("/:type", adminOnly, downloadLimit, validate(downloadSchema), controller.download);
  return router;
}
