"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useMeQuery } from "@/features/auth/api/authApi";
import { getApiErrorCode, getApiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/cn";
import { formatCount, formatDateTime } from "@/lib/formatters";
import {
  useGetTermsQuery,
  useRestoreTermsMutation,
  useSaveTermsMutation,
  type AdminTerms,
} from "../api/termsApi";
import { RichTextEditor } from "./RichTextEditor";
import { TermsPreview } from "./TermsPreview";

const SUMMARY_MAX = 160;
const fmt = formatDateTime;
const icon = (name: string, size = 16) => (
  <MaskIcon src={`/images/icons/${name}.svg`} size={size} />
);

interface Draft {
  title: string;
  summary: string;
  html: string;
}

const fromTerms = (t: AdminTerms | null): Draft => ({
  title: t?.title ?? "Terms & Conditions",
  summary: t?.summary ?? "",
  html: t?.html ?? "",
});

export function TermsScreen() {
  const { data: terms, isLoading, refetch } = useGetTermsQuery();
  if (isLoading || terms === undefined) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-7" label="Loading terms" />
      </div>
    );
  }
  // Remount the editor whenever a new version arrives from the server.
  return (
    <TermsEditorForm key={terms?.version ?? 0} terms={terms} onReload={() => void refetch()} />
  );
}

function TermsEditorForm({ terms, onReload }: { terms: AdminTerms | null; onReload: () => void }) {
  const toast = useToast();
  const ids = { title: useId(), summary: useId() };
  const { data: me } = useMeQuery();
  const canEdit = me?.role === "admin";
  const [save, { isLoading: saving }] = useSaveTermsMutation();
  const [restore, { isLoading: restoring }] = useRestoreTermsMutation();

  // The loaded version (this component remounts when a new version arrives).
  const [initial] = useState<Draft>(() => fromTerms(terms));
  const [draft, setDraft] = useState<Draft>(initial);
  const [stats, setStats] = useState({ words: 0, characters: 0 });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const previewRef = useRef<HTMLDialogElement>(null);

  // TipTap normalises HTML on load, so compare against what the editor produced first.
  const [baselineHtml, setBaselineHtml] = useState<string | null>(null);
  const dirty =
    draft.title !== initial.title ||
    draft.summary !== initial.summary ||
    (baselineHtml !== null && draft.html !== baselineHtml);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    const dialog = previewRef.current;
    if (previewOpen && dialog && !dialog.open) dialog.showModal();
  }, [previewOpen]);

  const summaryTooLong = draft.summary.length > SUMMARY_MAX;
  const canSave =
    canEdit &&
    dirty &&
    !summaryTooLong &&
    draft.title.trim() &&
    draft.summary.trim() &&
    stats.words > 0;

  const onSave = async () => {
    const result = await save({ ...draft, baseVersion: terms?.version ?? null });
    if ("error" in result) {
      if (getApiErrorCode(result.error) === "CONTENT_CONFLICT") {
        toast.error(
          "Another admin saved a newer version. Reloading it — copy your changes first if needed.",
        );
        onReload();
      } else toast.error(getApiErrorMessage(result.error));
      return;
    }
    toast.success(`Saved as version ${result.data.version}. Live on the offer site.`);
  };

  return (
    <>
      <PageHeader
        title="Terms & Conditions"
        description="Edit the text shown in the Terms pop-up and on the home page."
        actions={
          <>
            <Button size="lg" variant="secondary" onClick={() => setPreviewOpen(true)}>
              {icon("eye-16")} Preview
            </Button>
            {canEdit && (
              <Button size="lg" onClick={onSave} disabled={!canSave || saving}>
                {icon("check-16")} {saving ? "Saving…" : "Save changes"}
              </Button>
            )}
          </>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
        {/* Figma "Editor card" (240:582): 24px padding, 22px between fields. */}
        <Card className="flex flex-col gap-[22px] p-6">
          <Field label="Pop-up title" htmlFor={ids.title}>
            <Input
              id={ids.title}
              value={draft.title}
              disabled={!canEdit}
              maxLength={120}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </Field>

          <Field
            label="Home page summary"
            htmlFor={ids.summary}
            aside={
              <span
                className={cn(
                  "text-xs leading-[normal] font-medium tabular-nums",
                  summaryTooLong ? "font-semibold text-red-600" : "text-subtle",
                )}
              >
                {draft.summary.length} / {SUMMARY_MAX}
              </span>
            }
            hint="Shown under “Terms & Conditions” at the bottom of the home page."
            error={summaryTooLong ? `Keep it under ${SUMMARY_MAX} characters` : undefined}
          >
            <Textarea
              id={ids.summary}
              rows={2}
              className="min-h-[44px]"
              value={draft.summary}
              disabled={!canEdit}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
            />
          </Field>

          <Field
            label="Pop-up content"
            aside={
              <span className="text-subtle text-xs leading-[normal] font-medium">Rich text</span>
            }
          >
            <RichTextEditor
              label="Pop-up content"
              resetKey={terms?.version ?? 0}
              value={initial.html}
              disabled={!canEdit}
              onChange={(html, s) => {
                setBaselineHtml((b) => b ?? html);
                setDraft((d) => ({ ...d, html }));
                setStats(s);
              }}
              footer={
                <>
                  <span>
                    {formatCount(stats.words)} words · {formatCount(stats.characters)} characters
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {icon("clock", 14)}
                    {dirty
                      ? "Unsaved changes"
                      : terms
                        ? `Last saved ${fmt(terms.updatedAt)}`
                        : "Not published yet"}
                  </span>
                </>
              }
            />
          </Field>
        </Card>

        <aside className="flex flex-col gap-6 leading-[normal] xl:sticky xl:top-0">
          {/* Figma "Pop-up preview" (240:660) */}
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-ink text-base font-bold">Pop-up preview</h2>
              <span className="rounded-full bg-[#fce7f0] px-2.5 py-1 text-xs font-semibold text-[#e2136e]">
                Mobile
              </span>
            </div>
            <TermsPreview title={draft.title} html={draft.html} compact />
          </Card>

          {/* Figma "Version history" (240:675) */}
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-ink text-base font-bold">Version history</h2>
              <p className="text-subtle text-xs">Restore any previous version</p>
            </div>
            {!terms && <p className="text-muted text-xs">Nothing published yet.</p>}
            <ul className="flex flex-col gap-3.5">
              {terms && (
                <VersionRow
                  version={terms.version}
                  meta={`${fmt(terms.updatedAt)} · ${terms.updatedByName ?? "System"}${
                    terms.restoredFrom ? ` · restored v${terms.restoredFrom}` : ""
                  }`}
                  action={
                    <span className="flex items-center gap-1.5 rounded-full bg-[#fce7f0] px-2.5 py-1 text-xs font-semibold text-[#e2136e]">
                      <span aria-hidden className="size-1.5 rounded-full bg-[#e2136e]" />
                      Current
                    </span>
                  }
                />
              )}
              {terms?.history.map((h) => (
                <VersionRow
                  key={h.version}
                  divided
                  version={h.version}
                  meta={`${fmt(h.savedAt)} · ${h.updatedByName ?? "System"}`}
                  action={
                    canEdit && (
                      <button
                        type="button"
                        onClick={() => setRestoreVersion(h.version)}
                        className="text-[13px] font-semibold text-[#e2136e] hover:underline"
                      >
                        Restore
                      </button>
                    )
                  }
                />
              ))}
            </ul>
          </Card>
        </aside>
      </div>

      <dialog
        ref={previewRef}
        onClose={(e) => e.target === e.currentTarget && setPreviewOpen(false)}
        aria-label="Terms pop-up preview"
        className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-visible bg-transparent p-0"
      >
        {previewOpen && (
          <div className="relative">
            <button
              type="button"
              onClick={() => previewRef.current?.close()}
              aria-label="Close preview"
              className="text-ink absolute -top-3 -right-3 z-10 grid size-8 place-items-center rounded-full bg-white shadow"
            >
              {icon("close-12", 12)}
            </button>
            <TermsPreview title={draft.title} html={draft.html} />
          </div>
        )}
      </dialog>

      <ConfirmDialog
        open={restoreVersion !== null}
        title={`Restore version ${restoreVersion ?? ""}?`}
        description={`Version ${restoreVersion ?? ""} goes live on the offer site again. The current version moves to the history, so you can switch back any time.`}
        confirmLabel="Restore"
        busy={restoring}
        onCancel={() => setRestoreVersion(null)}
        onConfirm={async () => {
          if (restoreVersion === null) return;
          const result = await restore(restoreVersion);
          if ("error" in result) toast.error(getApiErrorMessage(result.error));
          else toast.success(`Version ${result.data.version} is live again`);
          setRestoreVersion(null);
        }}
      />
    </>
  );
}

/** One "Version N · date · admin" row; rows after the first get a divider above. */
function VersionRow({
  version,
  meta,
  action,
  divided,
}: {
  version: number;
  meta: string;
  action: React.ReactNode;
  divided?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3",
        divided && "border-line border-t pt-3.5",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-ink text-[13px] font-semibold">Version {version}</p>
        <p className="text-subtle truncate text-xs">{meta}</p>
      </div>
      {action}
    </li>
  );
}
