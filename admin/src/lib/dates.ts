/**
 * Campaign dates are whole days in Bangladesh time (UTC+6, no DST).
 * The API stores endAt as EXCLUSIVE: a campaign "ending 30 Nov" ends at
 * 1 Dec 00:00 Dhaka. These helpers convert between <input type="date"> values
 * (YYYY-MM-DD) and API timestamps.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const DHAKA = "Asia/Dhaka";

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: DHAKA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA,
  day: "numeric",
  month: "short",
});
const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA,
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function startInputToIso(value: string): string {
  return new Date(`${value}T00:00:00+06:00`).toISOString();
}

export function endInputToIso(value: string): string {
  return new Date(new Date(`${value}T00:00:00+06:00`).getTime() + DAY_MS).toISOString();
}

export function isoToStartInput(iso: string): string {
  return ymd.format(new Date(iso));
}

export function isoToEndInput(iso: string): string {
  return ymd.format(new Date(new Date(iso).getTime() - 1));
}

export function todayInput(offsetDays = 0): string {
  return ymd.format(new Date(Date.now() + offsetDays * DAY_MS));
}

/** "15 Oct – 30 Nov 2026" */
export function formatDuration(startIso: string, endIso: string): string {
  const lastDay = new Date(new Date(endIso).getTime() - 1);
  return `${dayMonth.format(new Date(startIso))} – ${dayMonthYear.format(lastDay)}`;
}

/** Input date → "30 Nov" (preview chip / default validity label). */
export function inputToDayMonth(value: string): string {
  return dayMonth.format(new Date(`${value}T12:00:00+06:00`));
}

/** "2026-11-23" (Dhaka day key) → "23 Nov" for chart axes. */
export function dayKeyLabel(key: string): string {
  return inputToDayMonth(key);
}

/** ISO → "30 Nov" (exclusive end → last live day). */
export function endDayLabel(iso: string): string {
  return dayMonth.format(new Date(new Date(iso).getTime() - 1));
}

/** ISO end → "30 Nov 2026". */
export function endDateLabel(iso: string): string {
  return dayMonthYear.format(new Date(new Date(iso).getTime() - 1));
}

/** Whole days left until an (exclusive) end. */
export function daysLeft(iso: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY_MS));
}
