import type { Metadata } from "next";
import { ExportScreen } from "@/features/exports/components/ExportScreen";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "Export Data" };

export default function ExportPage() {
  return <ExportScreen />;
}
