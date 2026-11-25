import type { Metadata } from "next";
import { TermsScreen } from "@/features/terms/components/TermsScreen";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return <TermsScreen />;
}
