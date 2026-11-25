"use client";

import { RotateCw, WifiOff } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/** Shown when the home page can't load offers (e.g. API unreachable). */
export default function HomeError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Hook for error reporting (Sentry etc.) in a later phase.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="bg-brand-100 text-brand-500 grid size-14 place-items-center rounded-2xl">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-ink text-lg font-bold">We couldn&apos;t load the offers</h1>
        <p className="text-muted mt-1 text-sm">Please check your connection and try again.</p>
      </div>
      <Button onClick={() => retry()}>
        <RotateCw className="size-4" />
        Try again
      </Button>
    </main>
  );
}
