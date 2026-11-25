const count = new Intl.NumberFormat("en-IN");

/** 241300 → "2,41,300" (South-Asian grouping, as in the design). */
export function formatCount(value: number): string {
  return count.format(value);
}

/** "Admin User" → "AU" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** "01712345678" → "01712 345 678" (as shown in the admin design). */
export function formatPhone(phone: string): string {
  return /^\d{11}$/.test(phone)
    ? `${phone.slice(0, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`
    : phone;
}

/** "2m ago", "3h ago", "Yesterday", "5 Nov". */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dhaka",
  })
    .format(new Date(iso))
    .replace("Sept", "Sep");
}

/** "5 Nov, 10:42 AM" (Bangladesh time) — Figma "Last shared". */
export function formatDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dhaka",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
  const month = get("month").replace("Sept", "Sep");
  return `${get("day")} ${month}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

/** Signed percentage for KPI chips: 12.4 → "+12.4%". */
export function formatChange(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct}%`;
}
