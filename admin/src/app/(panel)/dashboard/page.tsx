import type { Metadata } from "next";
import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";

/** Rendered only after the client-side session check (see AdminShell), so skip instant-navigation validation. */
export const instant = false;

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
