import type { Clock } from "./clock.js";

/**
 * Tiny in-process cache for hot, slightly-stale-tolerant reads (public stats).
 * Concurrent misses share one in-flight promise (no thundering herd).
 * Swap for Redis when running multiple API instances needs a shared cache.
 */
export class TtlCache<T> {
  private value: { data: T; expiresAt: number } | undefined;
  private inFlight: Promise<T> | undefined;

  constructor(
    private readonly ttlMs: number,
    private readonly clock: Clock,
  ) {}

  async get(load: () => Promise<T>): Promise<T> {
    const now = this.clock.now().getTime();
    if (this.value && this.value.expiresAt > now) return this.value.data;
    if (this.inFlight) return this.inFlight;

    this.inFlight = load()
      .then((data) => {
        this.value = { data, expiresAt: this.clock.now().getTime() + this.ttlMs };
        return data;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    return this.inFlight;
  }

  clear(): void {
    this.value = undefined;
  }
}
