"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLogoutMutation, type Admin } from "@/features/auth/api/authApi";
import { useListCampaignsQuery } from "@/features/campaigns/api/campaignsApi";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/formatters";
import { baseApi } from "@/store/baseApi";
import { useAppDispatch } from "@/store/hooks";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { NAV_ITEMS } from "./nav";

export function Sidebar({ admin }: { admin: Admin }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [logout, { isLoading: loggingOut }] = useLogoutMutation();
  // Tiny request just for the tab counts ("2 live" badge).
  const { data: liveSummary } = useListCampaignsQuery({ status: "live", page: 1, limit: 1 });
  const liveCount = liveSummary?.counts.live ?? 0;

  const signOut = async () => {
    await logout();
    dispatch(baseApi.util.resetApiState());
    router.replace("/login");
  };

  // Figma "Sidebar" (node 236:478): 264px, 20/24 padding, 6px between items.
  return (
    <aside className="border-line flex h-full w-[264px] shrink-0 flex-col gap-1.5 border-r bg-white px-5 py-6">
      <Link href="/dashboard" className="flex items-center gap-3 pb-6 pl-2">
        <span
          className="grid size-10 place-items-center rounded-xl"
          style={{ backgroundImage: "linear-gradient(135deg, #e2136e 14.64%, #800038 85.36%)" }}
        >
          <MaskIcon src="/images/icons/gift-white.svg" size={22} className="text-white" />
        </span>
        <span className="flex flex-col gap-px leading-[normal] whitespace-nowrap">
          <span className="text-ink text-lg font-bold">Mnemonic</span>
          <span className="text-subtle text-xs font-medium">Offer Admin</span>
        </span>
      </Link>

      <p className="text-subtle pb-1.5 pl-3.5 text-[11px] leading-[normal] font-bold tracking-[1px] uppercase">
        Menu
      </p>
      <nav aria-label="Main" className="flex flex-col gap-1.5">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[46px] items-center gap-3 rounded-xl px-3.5 text-sm leading-[normal] transition-colors",
                active
                  ? "bg-brand-500 font-semibold text-white drop-shadow-[0_4px_6px_rgb(74_25_48/0.18)]"
                  : "text-muted hover:bg-canvas hover:text-ink font-medium",
              )}
            >
              <MaskIcon src={icon} className={active ? "text-white" : "text-subtle"} />
              <span className="flex-1 whitespace-nowrap">{label}</span>
              {href === "/campaigns" && liveCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] leading-[normal] font-bold",
                    active ? "bg-white/25 text-white" : "bg-[#fce7f0] text-[#e2136e]",
                  )}
                >
                  {liveCount} live
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="bg-canvas mt-auto flex items-center gap-2.5 rounded-[14px] p-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-full text-[13.2px] font-bold text-white"
          style={{ backgroundImage: "linear-gradient(135deg, #e2136e 14.64%, #800038 85.36%)" }}
        >
          {initials(admin.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px leading-[normal]">
          <span className="text-ink truncate text-[13px] font-semibold">{admin.name}</span>
          <span className="text-subtle truncate text-[11px]">{admin.email}</span>
        </span>
        <button
          type="button"
          onClick={signOut}
          disabled={loggingOut}
          aria-label="Sign out"
          className="text-subtle hover:text-ink -m-1 grid place-items-center rounded-lg p-1 hover:bg-white"
        >
          <MaskIcon src="/images/icons/logout.svg" size={18} />
        </button>
      </div>
    </aside>
  );
}
