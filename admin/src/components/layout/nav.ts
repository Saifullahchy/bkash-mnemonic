export interface NavItem {
  href: string;
  label: string;
  /** Figma sidebar icon (20px), painted in the item's text colour. */
  icon: string;
}

/** Sidebar menu, in design order (Figma "Admin / 02 Dashboard" sidebar). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "/images/icons/nav-dash.svg" },
  { href: "/campaigns", label: "Campaigns", icon: "/images/icons/nav-mega.svg" },
  { href: "/leaderboard", label: "Leaderboard", icon: "/images/icons/nav-trophy.svg" },
  { href: "/participants", label: "Participants", icon: "/images/icons/nav-users.svg" },
  { href: "/terms", label: "Terms & Conditions", icon: "/images/icons/nav-file.svg" },
  { href: "/export", label: "Export Data", icon: "/images/icons/nav-dl.svg" },
];

/** Breadcrumb trail for a path: "Admin › Campaigns › New campaign". */
export function breadcrumbsFor(pathname: string): string[] {
  const section = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  const trail = ["Admin", section?.label ?? "Dashboard"];
  if (pathname === "/campaigns/new") trail.push("New campaign");
  else if (/^\/campaigns\/[^/]+\/edit$/.test(pathname)) trail.push("Edit campaign");
  return trail;
}
