"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useMeQuery } from "@/features/auth/api/authApi";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * Authenticated layout. The proxy already redirects visitors without a cookie;
 * this verifies the session with the API (expired, revoked or deactivated
 * admins are sent back to /login).
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { data: admin, isError } = useMeQuery();
  const router = useRouter();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // The content area is the scroller (not the window), so start each page at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  useEffect(() => {
    if (isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isError, pathname, router]);

  if (!admin) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-7" label="Checking your session" />
      </div>
    );
  }

  return (
    // App-style shell: the window never scrolls. Sidebar and top bar stay put and
    // only the page content scrolls, so nothing shifts or bounces (e.g. when a
    // drawer opens and the page scrollbar would otherwise disappear).
    <div className="flex h-dvh overflow-hidden">
      <Sidebar admin={admin} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar admin={admin} />
        {/*
          Figma "Body": 32px padding; content is 1112px wide (1440 frame − 264 sidebar
          − 2×32). Wider screens keep that width, centred, on every page.
        */}
        <main
          ref={mainRef}
          className="scrollbar-pink min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain p-8"
        >
          <div className="mx-auto w-full max-w-[1112px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
