import { Hammer } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "./PageHeader";

/** Placeholder for screens scheduled in later phases. */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: number;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <span className="bg-brand-50 text-brand-500 grid size-12 place-items-center rounded-xl">
          <Hammer className="size-6" aria-hidden />
        </span>
        <p className="text-ink font-semibold">Coming in phase {phase}</p>
        <p className="text-muted max-w-sm text-sm">
          This screen is designed and scheduled; the API and data are being built first.
        </p>
      </Card>
    </>
  );
}
