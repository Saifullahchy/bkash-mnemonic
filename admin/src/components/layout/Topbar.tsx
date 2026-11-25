"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Admin } from "@/features/auth/api/authApi";
import { initials } from "@/lib/formatters";
import { breadcrumbsFor } from "./nav";

export function Topbar({ admin }: { admin: Admin }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const trail = breadcrumbsFor(pathname);

  // Phone numbers (mostly digits) search Participants; anything else searches Campaigns.
  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const digits = q.replace(/[\s+-]/g, "");
    router.push(
      /^\d{3,}$/.test(digits)
        ? `/participants?search=${encodeURIComponent(digits)}`
        : `/campaigns?search=${encodeURIComponent(q)}`,
    );
  };

  // Figma "Top bar" (node 236:547): 72px, 32px sides, white with a bottom border.
  return (
    <header className="border-line z-20 flex h-[72px] shrink-0 items-center justify-between gap-6 border-b bg-white/95 px-8 backdrop-blur">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-[13px] leading-[normal]">
          {trail.map((crumb, i) => (
            <li key={crumb} className="flex items-center gap-2">
              {i > 0 && (
                <Image
                  src="/images/icons/chevron-right-14.svg"
                  alt=""
                  aria-hidden
                  width={14}
                  height={14}
                  unoptimized
                />
              )}
              <span
                className={
                  i === trail.length - 1 ? "text-ink font-semibold" : "text-subtle font-medium"
                }
              >
                {crumb}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <form onSubmit={onSearch} role="search">
          <label className="bg-field flex h-11 w-[320px] items-center gap-2.5 rounded-full px-4 transition-shadow focus-within:shadow-[0_0_0_3px_#fce7f0]">
            <Image
              src="/images/icons/search.svg"
              alt=""
              aria-hidden
              width={18}
              height={18}
              unoptimized
            />
            <span className="sr-only">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phone number or campaign"
              className="text-ink placeholder:text-subtle w-full bg-transparent text-[13px] outline-none"
            />
          </label>
        </form>
        <button
          type="button"
          aria-label="Notifications"
          className="grid size-11 place-items-center rounded-full transition-opacity hover:opacity-80"
        >
          <Image src="/images/icons/notifications.svg" alt="" width={44} height={44} unoptimized />
        </button>
        <span
          title={admin.name}
          className="grid size-10 place-items-center rounded-full text-[13.2px] font-bold text-white"
          style={{ backgroundImage: "linear-gradient(135deg, #e2136e 14.64%, #800038 85.36%)" }}
        >
          {initials(admin.name)}
        </span>
      </div>
    </header>
  );
}
