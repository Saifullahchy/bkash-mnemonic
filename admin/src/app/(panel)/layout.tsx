import { Suspense } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Authenticated panel. AdminShell (client) verifies the session with the API
 * and reads the URL (usePathname), so it sits in a Suspense boundary whose
 * fallback is the loading state.
 */
export default function PanelLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center">
          <Spinner className="size-7" />
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
