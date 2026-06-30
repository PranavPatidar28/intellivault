import { errorResponse } from '@/lib/api-error';

// NOTE: next/jest pins NODE_ENV to 'test' and the runtime does not allow it to
// be reassigned within a test (verified empirically). So these tests exercise
// the NON-production branch (test env is treated as non-production by the
// `process.env.NODE_ENV !== 'production'` check). The production-suppression
// branch cannot be exercised here without editing the locked jest config.
describe('errorResponse', () => {
  it('is running in a non-production NODE_ENV (sanity check)', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
  });

  it('returns a NextResponse with the given status', async () => {
    const res = errorResponse('Not found', 404);
    expect(res.status).toBe(404);
  });

  it('includes the message in the body', async () => {
    const res = errorResponse('Bad request', 400);
    const body = await res.json();
    expect(body.error).toBe('Bad request');
  });

  it('does not include details when no error is passed', async () => {
    const res = errorResponse('Something went wrong', 500);
    const body = await res.json();
    expect(body.error).toBe('Something went wrong');
    expect(body.details).toBeUndefined();
  });

  it('includes details in non-production when an Error is passed', async () => {
    const res = errorResponse('Server error', 500, new Error('db exploded'));
    const body = await res.json();
    expect(body.error).toBe('Server error');
    expect(body.details).toBe('db exploded');
  });

  it('does not include details when error is not an Error instance', async () => {
    const res = errorResponse('Server error', 500, 'just a string');
    const body = await res.json();
    expect(body.details).toBeUndefined();
  });

  it('does not include details when error is null/undefined', async () => {
    const res = errorResponse('Oops', 500, undefined);
    const body = await res.json();
    expect(body.details).toBeUndefined();
  });

  it('preserves arbitrary status codes', () => {
    expect(errorResponse('Teapot', 418).status).toBe(418);
    expect(errorResponse('Unauthorized', 401).status).toBe(401);
  });
});
