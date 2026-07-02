import { checkRateLimit, enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

describe('rate-limit', () => {
  let counter = 0;
  // Unique identifier per test so the module-level in-memory map can't bleed
  // state between cases.
  const uid = () => `id-${Date.now()}-${counter++}`;

  describe('checkRateLimit', () => {
    it('allows the first request and reports remaining', () => {
      const result = checkRateLimit(uid(), 5, 60_000);
      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
      expect(result.retryAfter).toBe(0);
    });

    it('decrements remaining across successive requests in the window', () => {
      const id = uid();
      expect(checkRateLimit(id, 3, 60_000).remaining).toBe(2);
      expect(checkRateLimit(id, 3, 60_000).remaining).toBe(1);
      expect(checkRateLimit(id, 3, 60_000).remaining).toBe(0);
    });

    it('succeeds exactly at the limit then fails beyond it', () => {
      const id = uid();
      // 3 allowed
      expect(checkRateLimit(id, 3, 60_000).success).toBe(true);
      expect(checkRateLimit(id, 3, 60_000).success).toBe(true);
      const atLimit = checkRateLimit(id, 3, 60_000);
      expect(atLimit.success).toBe(true);
      expect(atLimit.remaining).toBe(0);
      // 4th exceeds
      const over = checkRateLimit(id, 3, 60_000);
      expect(over.success).toBe(false);
      expect(over.remaining).toBe(0);
      expect(over.retryAfter).toBeGreaterThan(0);
    });

    it('clamps remaining at 0 (never negative) when far over limit', () => {
      const id = uid();
      checkRateLimit(id, 1, 60_000); // success, remaining 0
      checkRateLimit(id, 1, 60_000); // over
      const result = checkRateLimit(id, 1, 60_000); // further over
      expect(result.remaining).toBe(0);
      expect(result.success).toBe(false);
    });

    describe('with fake timers (window reset)', () => {
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      it('resets the window after windowMs elapses', () => {
        const id = uid();
        checkRateLimit(id, 1, 1000); // success, remaining 0
        const blocked = checkRateLimit(id, 1, 1000);
        expect(blocked.success).toBe(false);

        // Advance past the window so resetAt <= now.
        jest.setSystemTime(new Date('2024-01-01T00:00:02Z'));
        const after = checkRateLimit(id, 1, 1000);
        expect(after.success).toBe(true);
        expect(after.remaining).toBe(0);
      });

      it('computes retryAfter as ceil of seconds remaining', () => {
        const id = uid();
        checkRateLimit(id, 1, 10_000); // window resets in 10s
        // advance 2.5s
        jest.setSystemTime(new Date('2024-01-01T00:00:02.500Z'));
        const blocked = checkRateLimit(id, 1, 10_000);
        expect(blocked.success).toBe(false);
        // remaining ~7.5s -> ceil 8
        expect(blocked.retryAfter).toBe(8);
      });
    });
  });

  describe('RATE_LIMITS presets', () => {
    it('exposes ai/upload/bulk presets with expected shapes', () => {
      expect(RATE_LIMITS.ai).toEqual({ limit: 20, windowMs: 60_000 });
      expect(RATE_LIMITS.upload).toEqual({ limit: 30, windowMs: 60_000 });
      expect(RATE_LIMITS.bulk).toEqual({ limit: 10, windowMs: 60_000 });
    });
  });

  describe('enforceRateLimit', () => {
    it('returns null while within the limit', () => {
      const result = enforceRateLimit(uid(), { limit: 5, windowMs: 60_000 });
      expect(result).toBeNull();
    });

    it('returns a 429 NextResponse once the limit is exceeded', async () => {
      const id = uid();
      const preset = { limit: 1, windowMs: 60_000 };
      expect(enforceRateLimit(id, preset)).toBeNull(); // first ok
      const limited = enforceRateLimit(id, preset);
      expect(limited).not.toBeNull();
      expect(limited!.status).toBe(429);
      const body = await limited!.json();
      expect(body.error).toMatch(/too many requests/i);
    });

    it('reports zero remaining via checkRateLimit when the limit is exceeded', () => {
      // The 429 response headers (Retry-After / X-RateLimit-*) are set by the
      // route but cannot be asserted here: the jest.setup Response.json
      // polyfill drops custom init headers (keeps only content-type). We assert
      // the underlying rate-limit accounting instead, which feeds those headers.
      const id = uid();
      checkRateLimit(id, 1, 60_000); // consume the single slot
      const over = checkRateLimit(id, 1, 60_000);
      expect(over.success).toBe(false);
      expect(over.remaining).toBe(0);
      expect(over.limit).toBe(1);
      expect(over.retryAfter).toBeGreaterThan(0);
    });
  });
});
