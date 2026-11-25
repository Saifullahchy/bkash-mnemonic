import Link from "next/link";
import { LinkIcon } from "lucide-react";

export default function ShareLinkNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="bg-brand-100 text-brand-500 grid size-14 place-items-center rounded-2xl">
        <LinkIcon className="size-7" aria-hidden />
      </span>
      <div>
        <h1 className="text-ink text-lg font-bold">This link doesn&apos;t work</h1>
        <p className="text-muted mt-1 text-sm">It may be mistyped or no longer available.</p>
      </div>
      <Link
        href="/"
        className="bg-brand-500 hover:bg-brand-600 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
      >
        See live offers
      </Link>
    </div>
  );
}
