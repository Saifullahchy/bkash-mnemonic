/** Bangladesh Standard Time (UTC+6, no DST). Business days follow local time. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the current calendar day in Asia/Dhaka, as a UTC Date. */
export function startOfDhakaDay(now: Date): Date {
  const local = now.getTime() + DHAKA_OFFSET_MS;
  const localMidnight = local - (local % DAY_MS);
  return new Date(localMidnight - DHAKA_OFFSET_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dhakaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  month: "numeric",
  day: "numeric",
});

/** "30 Nov" in Dhaka time with fixed 3-letter months (ICU's en-GB says "Sept"). */
const dhakaDayMonth = {
  format(date: Date): string {
    const parts = dhakaParts.formatToParts(date);
    const day = Number(parts.find((p) => p.type === "day")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    return `${day} ${MONTHS[month - 1] ?? ""}`;
  },
};

/**
 * "Valid until 30 Nov" in Bangladesh time (default offer card validity label).
 * endAt is exclusive (a campaign ending on 30 Nov ends at 1 Dec 00:00 Dhaka),
 * so the label shows the last moment the campaign is live.
 */
export function validUntilLabel(endAt: Date): string {
  return `Valid until ${dhakaDayMonth.format(new Date(endAt.getTime() - 1))}`;
}

const dhakaYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dhaka",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-11-23" — the calendar day in Asia/Dhaka (chart buckets). */
export function dhakaDateKey(date: Date): string {
  return dhakaYmd.format(date);
}

const DHAKA_MS = 6 * 60 * 60 * 1000;

/**
 * Next run strictly after `now` at `hour`:00 Asia/Dhaka:
 * daily, weekly (Mondays) or monthly (1st of the month).
 */
export function nextDhakaRun(now: Date, frequency: "daily" | "weekly" | "monthly", hour = 9): Date {
  const local = new Date(now.getTime() + DHAKA_MS); // shift so UTC getters read Dhaka wall-clock
  const at = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, hour) - DHAKA_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();

  if (frequency === "monthly") {
    const thisMonth = at(y, m, 1);
    return thisMonth > now ? thisMonth : at(y, m + 1, 1);
  }
  if (frequency === "weekly") {
    const daysUntilMonday = (8 - local.getUTCDay()) % 7; // 0 when today is Monday
    const candidate = at(y, m, d + daysUntilMonday);
    return candidate > now ? candidate : at(y, m, d + daysUntilMonday + 7);
  }
  const today = at(y, m, d);
  return today > now ? today : at(y, m, d + 1);
}
