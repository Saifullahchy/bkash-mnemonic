"use client";

import { Flag, Trophy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorCode, getApiErrorDetails, getApiErrorMessage } from "@/lib/api/errors";
import { formatCount, formatPhone } from "@/lib/formatters";
import { useAnnounceWinnersMutation } from "../api/leaderboardApi";
import type { LeaderboardCampaign, LeaderboardRow } from "../types";

interface Props {
  open: boolean;
  campaign: LeaderboardCampaign;
  /** Current top N (preview of who will win). */
  winners: LeaderboardRow[];
  onClose: () => void;
}

/** Confirms the final result; flagged winners need a second, explicit confirmation. */
export function AnnounceWinnersDialog({ open, campaign, winners, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const toast = useToast();
  const [announce, { isLoading }] = useAnnounceWinnersMutation();
  const [flagged, setFlagged] = useState<
    { rank: number; phone: string; reason: string | null }[] | null
  >(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    setFlagged(null);
    onClose();
  };

  const submit = async (force: boolean) => {
    const result = await announce({ id: campaign.id, force });
    if ("error" in result) {
      if (getApiErrorCode(result.error) === "WINNERS_FLAGGED") {
        const details = getApiErrorDetails(result.error) as { flagged: typeof flagged };
        setFlagged(details?.flagged ?? []);
        return;
      }
      toast.error(getApiErrorMessage(result.error));
      return;
    }
    toast.success(`Winners announced for ${campaign.merchantName} offer`);
    close();
  };

  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby="announce-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-xl"
    >
      {open && (
        <div className="p-6">
          <span className="grid size-11 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <Trophy className="size-5" aria-hidden />
          </span>
          <h2 id="announce-title" className="text-ink mt-4 text-lg font-bold">
            Announce {campaign.numberOfWinners > 1 ? "winners" : "the winner"}?
          </h2>
          <p className="text-muted mt-1 text-sm">
            The final ranking for {campaign.merchantName} offer is saved permanently. This
            can&apos;t be undone.
          </p>

          <ol className="border-line mt-4 divide-y rounded-xl border">
            {winners.map((w) => (
              <li
                key={w.shareLinkId}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
              >
                <span className="text-ink flex items-center gap-2 font-semibold">
                  #{w.rank} {formatPhone(w.phone)}
                  {w.suspicious && (
                    <Flag className="size-3.5 text-amber-500" aria-label="Flagged" />
                  )}
                </span>
                <span className="text-muted tabular-nums">
                  {formatCount(campaign.rankingBasis === "opens" ? w.opens : w.shares)}{" "}
                  {campaign.rankingBasis}
                </span>
              </li>
            ))}
          </ol>

          {flagged && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
            >
              <p className="font-semibold">Flagged for suspicious activity:</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {flagged.map((f) => (
                  <li key={f.rank}>
                    #{f.rank} {formatPhone(f.phone)} — {f.reason ?? "flagged"}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Review them in Participants (void opens or disqualify), or announce anyway.
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={isLoading}>
              Cancel
            </Button>
            {flagged ? (
              <Button variant="danger" onClick={() => submit(true)} disabled={isLoading}>
                Announce anyway
              </Button>
            ) : (
              <Button onClick={() => submit(false)} disabled={isLoading}>
                <Trophy className="size-4" /> Announce
              </Button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
