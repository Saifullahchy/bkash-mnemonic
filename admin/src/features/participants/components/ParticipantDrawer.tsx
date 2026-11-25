"use client";

import { Ban, CircleSlash, Flag, FlagOff, Phone, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Textarea } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useMeQuery } from "@/features/auth/api/authApi";
import { getApiErrorMessage } from "@/lib/api/errors";
import { formatCount, formatPhone, timeAgo } from "@/lib/formatters";
import {
  useClearFlagMutation,
  useDisqualifyParticipantMutation,
  useGetParticipantQuery,
  useReinstateParticipantMutation,
  useVoidOpensMutation,
} from "../api/participantsApi";
import type { ParticipantLink } from "../types";
import { ParticipantStatusBadge } from "./ParticipantStatusBadge";

/** Why open attempts didn't count, in plain words. */
const REASONS: Record<string, string> = {
  duplicate: "Repeat visits",
  self_open: "Own opens",
  invalid_token: "Invalid / scripted",
  device_cap: "Device limit",
  subnet_cap: "Network limit",
  velocity_cap: "Burst limit",
  rate_limited: "Rate limited",
  campaign_inactive: "Campaign not live",
  link_frozen: "While frozen",
  bot: "Bots",
  voided: "Voided by admin",
};

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

/** Side panel with a participant's links, rejected-open breakdown and moderation actions. */
export function ParticipantDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const { data: me } = useMeQuery();
  const canModerate = me?.role === "admin";
  const { data, isLoading, error } = useGetParticipantQuery(id);
  const [disqualify, disqualifyState] = useDisqualifyParticipantMutation();
  const [reinstate, reinstateState] = useReinstateParticipantMutation();
  const [voidOpens, voidState] = useVoidOpensMutation();
  const [clearFlag] = useClearFlagMutation();
  const [reason, setReason] = useState("");
  const [confirmVoid, setConfirmVoid] = useState<ParticipantLink | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const run = async (action: Promise<{ error?: unknown }>, success: string) => {
    const result = await action;
    if (result.error)
      toast.error(getApiErrorMessage(result.error as Parameters<typeof getApiErrorMessage>[0]));
    else toast.success(success);
    return !result.error;
  };

  return (
    <dialog
      ref={ref}
      // Nested dialogs (void confirmation) emit their own close events; only react to ours.
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label="Participant details"
      className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-[460px] overflow-hidden bg-white p-0 shadow-2xl"
    >
      <div className="flex h-full flex-col">
        <header className="border-line flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-ink text-base font-bold">Participant</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="text-muted hover:text-ink grid size-8 place-items-center rounded-lg hover:bg-zinc-100"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="scrollbar-pink min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {isLoading && <Spinner className="mx-auto block size-6" />}
          {error && <p className="text-sm text-red-600">{getApiErrorMessage(error)}</p>}
          {data && (
            <>
              <section>
                <p className="text-ink flex items-center gap-2 text-xl font-bold tabular-nums">
                  <Phone className="text-muted size-4" aria-hidden />
                  {formatPhone(data.phone)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <ParticipantStatusBadge status={data.status} />
                  {data.flagged && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      <Flag className="size-3" aria-hidden /> Flagged
                    </span>
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  {[
                    [
                      "First login",
                      dateFmt.format(new Date(data.firstLoginAt)).replace("Sept", "Sep"),
                    ],
                    ["Last active", timeAgo(data.lastActiveAt)],
                    ["Total shares", formatCount(data.shares)],
                    ["Total opens", formatCount(data.opens)],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-canvas rounded-xl px-3 py-2.5">
                      <dt className="text-muted">{label}</dt>
                      <dd className="text-ink mt-0.5 text-sm font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                {data.disqualifiedReason && (
                  <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                    Disqualified: {data.disqualifiedReason}
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="text-ink text-sm font-bold">Share links</h3>
                {data.links.length === 0 && (
                  <p className="text-muted text-xs">Hasn&apos;t joined a campaign yet.</p>
                )}
                {data.links.map((link) => {
                  const rejected = Object.entries(link.rejectedOpens);
                  return (
                    <article key={link.shareLinkId} className="border-line rounded-xl border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-ink text-[13px] font-bold">{link.campaign.name} offer</p>
                        <code className="text-muted text-[11px]">/s/{link.code}</code>
                      </div>
                      <p className="text-muted mt-1 text-xs">
                        <span className="text-ink font-semibold">{formatCount(link.opens)}</span>{" "}
                        counted opens ·{" "}
                        <span className="text-ink font-semibold">{formatCount(link.shares)}</span>{" "}
                        shares
                        {link.flags.frozen && <span className="ml-1 text-red-600">· frozen</span>}
                      </p>
                      {link.flags.suspicious && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                          <Flag className="mt-px size-3 shrink-0" aria-hidden />
                          {link.flags.suspiciousReason}
                        </p>
                      )}
                      {rejected.length > 0 && (
                        <div className="mt-3">
                          <p className="text-muted text-[11px] font-semibold">Not counted</p>
                          <ul className="mt-1 flex flex-wrap gap-1.5">
                            {rejected.map(([r, n]) => (
                              <li
                                key={r}
                                className="bg-canvas text-ink rounded-full px-2 py-0.5 text-[11px]"
                              >
                                {REASONS[r] ?? r}:{" "}
                                <span className="font-semibold">{formatCount(n)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {canModerate && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {link.opens > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setConfirmVoid(link)}
                            >
                              <CircleSlash className="size-3.5" /> Void opens
                            </Button>
                          )}
                          {link.flags.suspicious && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void run(
                                  clearFlag({ shareLinkId: link.shareLinkId, participantId: id }),
                                  "Flag cleared",
                                )
                              }
                            >
                              <FlagOff className="size-3.5" /> Clear flag
                            </Button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>

              {canModerate && (
                <section className="border-line space-y-3 border-t pt-5">
                  {data.status === "disqualified" ? (
                    <Button
                      variant="secondary"
                      fullWidth
                      disabled={reinstateState.isLoading}
                      onClick={() => void run(reinstate(id), "Participant reinstated")}
                    >
                      <RotateCcw className="size-4" /> Reinstate participant
                    </Button>
                  ) : (
                    <>
                      <h3 className="text-ink text-sm font-bold">Disqualify</h3>
                      <p className="text-muted text-xs">
                        Removes them from every leaderboard and stops counting their links. Existing
                        opens are kept for the audit trail.
                      </p>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        placeholder="Reason (required), e.g. bought fake opens"
                        aria-label="Disqualification reason"
                      />
                      <Button
                        variant="danger"
                        fullWidth
                        disabled={reason.trim().length < 3 || disqualifyState.isLoading}
                        onClick={async () => {
                          if (
                            await run(
                              disqualify({ id, reason: reason.trim() }),
                              "Participant disqualified",
                            )
                          )
                            setReason("");
                        }}
                      >
                        <Ban className="size-4" /> Disqualify participant
                      </Button>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmVoid !== null}
        title="Void counted opens?"
        description={`${formatCount(confirmVoid?.opens ?? 0)} counted opens on this ${confirmVoid?.campaign.name ?? ""} link will stop counting, and the leaderboard updates. They stay in the audit trail.`}
        confirmLabel="Void opens"
        destructive
        busy={voidState.isLoading}
        onCancel={() => setConfirmVoid(null)}
        onConfirm={async () => {
          if (!confirmVoid) return;
          await run(
            voidOpens({ shareLinkId: confirmVoid.shareLinkId, participantId: id }),
            "Opens voided",
          );
          setConfirmVoid(null);
        }}
      />
    </dialog>
  );
}
