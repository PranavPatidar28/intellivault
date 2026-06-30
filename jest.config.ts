import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Test match patterns - look for tests in __tests__ directory
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
  ],
  
  // Coverage configuration. The gate targets the business-logic layers that
  // are meaningfully unit-testable — API route handlers, hooks, and lib
  // utilities/services/validations. Presentational pages and feature
  // components are exercised via E2E (Playwright) rather than jsdom unit
  // tests, and vendored editor / design-system code is third-party template
  // code; including either here would make the coverage number reflect
  // untested template files rather than real logic.
  collectCoverageFrom: [
    'src/app/api/**/route.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/lib/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/generated/**',
    // Thin client/singleton wrappers with no logic of their own.
    '!src/lib/prisma.ts',
    '!src/lib/auth.ts',
    '!src/lib/auth-client.ts',
    // Vendored TipTap editor helper hooks (ship with the editor template).
    '!src/hooks/use-tiptap-editor.ts',
    '!src/hooks/use-composed-ref.ts',
    '!src/hooks/use-cursor-visibility.ts',
    '!src/hooks/use-element-rect.ts',
    '!src/hooks/use-menu-navigation.ts',
    '!src/hooks/use-scrolling.ts',
  ],
  
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // Next.js will handle TypeScript transformation
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs'],
  
  // Ignore patterns - ALLOW better-auth and jose to be transformed
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transformIgnorePatterns: [
    'node_modules/(?!(better-auth|jose|@better-auth)/)',
  ],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
