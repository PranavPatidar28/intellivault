// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill Web APIs for Node environment
import { Request, Response as NodeFetchResponse, Headers } from 'node-fetch';

// Create Response with json static method and proper status exposure
class Response extends NodeFetchResponse {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    // node-fetch's Body/Response init types are narrower than the DOM lib's;
    // cast to bridge the two definitions in this polyfill.
    super(
      (body as unknown as ConstructorParameters<typeof NodeFetchResponse>[0]) || undefined,
      init as unknown as ConstructorParameters<typeof NodeFetchResponse>[1]
    );
    // Ensure status is directly accessible
    Object.defineProperty(this, 'status', {
      value: init?.status || 200,
      writable: false,
      enumerable: true,
      configurable: false
    });
  }

  static json(data: any, init?: ResponseInit) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    return new Response(JSON.stringify(data), {
      status: init?.status || 200,
      ...init,
      headers,
    });
  }
}

// Make Web APIs globally available
global.Request = Request as unknown as typeof globalThis.Request;
global.Response = Response as unknown as typeof globalThis.Response;
global.Headers = Headers as unknown as typeof globalThis.Headers;

// Mock the auth module BEFORE any imports
const mockAuth = {
  api: {
    getSession: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    signUp: jest.fn(),
  },
};

jest.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

// Export mockAuth to be used in tests
(global as any).mockAuth = mockAuth;

// Mock Prisma globally so route/service modules never construct the real
// PrismaClient (which throws on missing DATABASE_URL in the test env). The
// jest.mock factory in __tests__/mocks/prisma.ts is not hoisted above the
// route imports in each test file, so it must live here in setup to apply
// before any module under test loads. Tests still import the same
// mockPrismaClient object to configure return values.
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockPrismaClient } = require('./__tests__/mocks/prisma');
  return { __esModule: true, default: mockPrismaClient };
});

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock Next.js headers - return a function that returns a Promise
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
  cookies: jest.fn(() => Promise.resolve({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Suppress console errors in tests (optional - remove if you want to see them)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

