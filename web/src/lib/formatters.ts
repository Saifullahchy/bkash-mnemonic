// South-Asian digit grouping, e.g. 152053 -> "1,52,053" (matches the design).
const countFormatter = new Intl.NumberFormat("en-IN");

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

/** "friend" / "friends" style pluralisation for English copy. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Masks a BD phone for display: 01712345678 -> 017•••••678 */
export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 3)}${"•".repeat(phone.length - 6)}${phone.slice(-3)}`;
}
