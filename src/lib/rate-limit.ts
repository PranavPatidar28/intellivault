/**
 * Lightweight in-memory rate limiter.
 *
 * Keyed per identifier (typically the authenticated user id) with a fixed
 * window. This protects against runaway loops and casual abuse of expensive
 * endpoints (LLM/embedding/upload) without requiring external infrastructure.
 *
 * LIMITATION: state is per-process. On multi-instance serverless (e.g. Vercel)
 * each instance keeps its own counters, so the effective limit scales with the
 * number of warm instances. For strict global limits, back this with a shared
 * store (e.g. @upstash/ratelimit on Redis) — the `checkRateLimit` interface is
 * intentionally compatible with such a swap.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map can't grow unbounded for one-off identifiers.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfter: number;
}

/**
 * Record a hit for `identifier` and report whether it is within `limit`
 * requests per `windowMs`.
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(identifier);

  if (!existing || existing.resetAt <= now) {
    buckets.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, limit, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  const success = existing.count <= limit;
  return {
    success,
    limit,
    remaining,
    retryAfter: success ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Common presets (requests per window). */
export const RATE_LIMITS = {
  // Expensive AI/LLM endpoints: bounded but allows normal interactive use.
  ai: { limit: 20, windowMs: 60_000 },
  // Uploads: storage-cost sensitive.
  upload: { limit: 30, windowMs: 60_000 },
  // Bulk/import operations.
  bulk: { limit: 10, windowMs: 60_000 },
} as const;

import { NextResponse } from "next/server";

/**
 * Enforce a rate limit for `identifier`. Returns a 429 NextResponse when the
 * limit is exceeded, or null when the request may proceed. Usage:
 *
 *   const limited = enforceRateLimit(session.user.id, RATE_LIMITS.ai);
 *   if (limited) return limited;
 */
export function enforceRateLimit(
  identifier: string,
  preset: { limit: number; windowMs: number }
): NextResponse | null {
  const result = checkRateLimit(identifier, preset.limit, preset.windowMs);
  if (result.success) return null;

  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    }
  );
}
