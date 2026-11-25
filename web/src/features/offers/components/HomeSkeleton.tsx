import { Container } from "@/components/layout/Container";

/** Shown instantly (static shell) while offers stream in from the API. */
export function HomeSkeleton() {
  return (
    <Container className="space-y-7 px-3 pt-6 pb-6 md:space-y-8 md:pt-8">
      <span className="sr-only">Loading offers…</span>
      <div
        aria-hidden
        className="bg-brand-100 mb-3 h-[244px] animate-pulse rounded-2xl md:h-[340px]"
      />
      <div aria-hidden className="space-y-2">
        <div className="h-5 w-32 animate-pulse rounded bg-zinc-200" />
        <div className="h-3 w-48 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-hidden
            className="overflow-hidden rounded-[22px] border border-[#dadada] bg-white"
          >
            <div className="aspect-[349/152] animate-pulse bg-zinc-200" />
            <div className="space-y-3 p-3">
              <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
              <div className="h-[76px] animate-pulse rounded-xl bg-zinc-100" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 animate-pulse rounded-xl bg-zinc-100" />
                <div className="bg-brand-100 h-11 animate-pulse rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
