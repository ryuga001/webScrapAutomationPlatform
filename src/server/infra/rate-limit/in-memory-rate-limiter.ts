import type { IRateLimiter } from "@/server/domain/rate-limit";
import { RateLimitError } from "@/server/domain/errors";

interface Window {
  count: number;
  resetAt: number;
}

// Fixed-window rate limiter kept in process memory. This is per-instance only —
// on a multi-instance deployment each instance counts independently. Good enough
// as a first cost/abuse guard; swap for a Redis-backed IRateLimiter later.
export class InMemoryRateLimiter implements IRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): void {
    const t = this.now();
    const w = this.windows.get(key);
    if (!w || t >= w.resetAt) {
      this.windows.set(key, { count: 1, resetAt: t + this.windowMs });
      return;
    }
    if (w.count >= this.limit) throw new RateLimitError();
    w.count += 1;
  }
}
