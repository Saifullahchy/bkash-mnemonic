import type { Store } from "express-rate-limit";

/** Creates one rate-limit store per limiter (each needs its own key prefix). */
export type RateLimitStoreFactory = (name: string) => Store;

/** Runtime switches passed from the container to feature routers. */
export interface RouterConfig {
  rateLimitEnabled: boolean;
  trustProxy: number;
  /** Shared with the web/admin servers so their X-Client-IP is trusted; undefined = never. */
  proxySecret?: string;
  /** Shared store (Redis) so limits hold across API instances; undefined = in-memory. */
  rateLimitStore?: RateLimitStoreFactory;
}
