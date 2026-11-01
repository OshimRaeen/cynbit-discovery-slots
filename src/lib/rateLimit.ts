// Fixed-window rate limiter, kept in memory.
//
// Good enough to show the shape of the fix and to test it. On Vercel each serverless
// instance has its own memory, so in production the same idea needs a shared store
// (Upstash Redis, Vercel KV) or the platform's own rate limiting rules.

type Options = {
  limit: number; // requests allowed per window
  windowMs: number;
  now?: () => number; // injectable so tests don't have to wait
};

export type LimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export class FixedWindowLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private limit: number;
  private windowMs: number;
  private now: () => number;

  constructor({ limit, windowMs, now = Date.now }: Options) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  check(key: string): LimitResult {
    const t = this.now();
    this.sweep(t);

    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      return { allowed: true };
    }

    if (entry.count >= this.limit) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - t) / 1000) };
    }

    entry.count += 1;
    return { allowed: true };
  }

  // Stops the map from growing forever when lots of different IPs show up.
  private sweep(t: number) {
    if (this.hits.size < 5000) return;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= t) this.hits.delete(key);
    }
  }
}
