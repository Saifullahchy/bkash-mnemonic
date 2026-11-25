"use client";

import { Button, type ButtonProps } from "@/components/ui/Button";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { useMeQuery } from "@/features/auth/api/authApi";
import { useDownload } from "../useDownload";

/** "Export Excel" header button used on Campaigns, Participants and Leaderboard. Admin role only. */
export function ExportButton({
  path,
  label = "Export Excel",
  variant = "outline",
}: {
  path: string;
  label?: string;
  variant?: ButtonProps["variant"];
}) {
  const { data: me } = useMeQuery();
  const { download, busy } = useDownload();
  const allowed = me?.role === "admin";
  return (
    <Button
      variant={variant}
      size="lg"
      disabled={!allowed || busy !== null}
      title={allowed ? undefined : "Only admins can export personal data"}
      onClick={() => void download(path)}
    >
      {/* Painted in the text colour: pink on outline buttons, white on primary. */}
      <MaskIcon src="/images/icons/btn-dl.svg" size={16} />
      {busy ? "Preparing…" : label}
    </Button>
  );
}
