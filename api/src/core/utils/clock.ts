/**
 * Injectable time source. Services depend on Clock instead of calling
 * `new Date()` so time-based rules (campaign start/end, rate windows) are testable.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function fixedClock(date: Date | string | number): Clock {
  const fixed = new Date(date);
  return { now: () => new Date(fixed) };
}
