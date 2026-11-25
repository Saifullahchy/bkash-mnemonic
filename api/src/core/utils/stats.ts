/** Period-over-period change in %, one decimal. New activity from zero counts as +100%. */
export function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
