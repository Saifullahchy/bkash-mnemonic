"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { isApiErrorBody } from "@/lib/api/envelope";
import { API_BASE } from "@/lib/env";
import { baseApi } from "@/store/baseApi";
import { useAppDispatch } from "@/store/hooks";
import type { ExportType } from "./api/exportsApi";

/** Builds an export URL: /admin/exports/:type?campaignId&from&to */
export function exportPath(
  type: ExportType,
  filters: { campaignId?: string; from?: string; to?: string } = {},
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1])),
  );
  return `/admin/exports/${type}${query.size ? `?${query.toString()}` : ""}`;
}

/**
 * Downloads an .xlsx from the API with the admin cookie, saves it under the
 * server's filename, and shows API errors (403, 429…) as toasts.
 */
export function useDownload() {
  const toast = useToast();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState<string | null>(null);

  const download = useCallback(
    async (path: string, key = path) => {
      setBusy(key);
      try {
        const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => null);
          throw new Error(
            isApiErrorBody(body) ? body.error.message : `Download failed (${res.status})`,
          );
        }
        const name =
          /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
          "export.xlsx";
        const url = URL.createObjectURL(await res.blob());
        const a = Object.assign(document.createElement("a"), { href: url, download: name });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        toast.success(`Downloaded ${name}`);
        dispatch(baseApi.util.invalidateTags(["Exports", "CampaignList"]));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Download failed");
      } finally {
        setBusy(null);
      }
    },
    [dispatch, toast],
  );

  return { download, busy };
}
