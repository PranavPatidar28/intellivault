/**
 * Tests for the Better Auth catch-all handler route.
 *
 * This route is pure framework wiring: it re-exports the GET/POST handlers
 * produced by `toNextJsHandler(auth.handler)`. There is no app logic to test
 * here, so this is an intentional smoke test that verifies the module wires up
 * and exports the expected HTTP method handlers. We avoid exercising real
 * better-auth internals or network behavior.
 */

// `toNextJsHandler` is replaced with a factory that returns identifiable
// handler fns so we can assert the wiring without real auth/network behavior.
// The fns are created inside the (hoisted) mock factory to avoid TDZ issues.
jest.mock('better-auth/next-js', () => ({
  toNextJsHandler: jest.fn(() => ({
    GET: jest.fn(),
    POST: jest.fn(),
  })),
}));

import { GET, POST } from '@/app/api/auth/[...all]/route';
import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

describe('Auth catch-all route - /api/auth/[...all]', () => {
  it('exports GET and POST handlers', () => {
    expect(GET).toBeDefined();
    expect(POST).toBeDefined();
    expect(typeof GET).toBe('function');
    expect(typeof POST).toBe('function');
  });

  it('wires the handlers via toNextJsHandler(auth.handler)', () => {
    expect(toNextJsHandler).toHaveBeenCalledWith((auth as any).handler);
    // The exported handlers are exactly the ones the factory returned.
    const returned = (toNextJsHandler as jest.Mock).mock.results[0].value;
    expect(GET).toBe(returned.GET);
    expect(POST).toBe(returned.POST);
  });
});
