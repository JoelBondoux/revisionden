import type { RateLimitBinding } from './env';

export type RateLimiter = RateLimitBinding;

export interface Clock {
  now(): Date;
}

/**
 * Fixed-window limiter kept in memory. Used in tests and local development; production uses
 * Cloudflare's rate limiting binding, which has the same `limit({ key })` shape.
 */
export function createMemoryRateLimiter(options: {
  limit: number;
  periodMs: number;
  clock: Clock;
}): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    async limit({ key }) {
      const now = options.clock.now().getTime();
      const w = windows.get(key);
      if (!w || now - w.start >= options.periodMs) {
        windows.set(key, { start: now, count: 1 });
        return { success: true };
      }
      w.count += 1;
      return { success: w.count <= options.limit };
    },
  };
}
