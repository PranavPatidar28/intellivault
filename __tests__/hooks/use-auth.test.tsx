import React from 'react';
import { renderHook } from '@testing-library/react';

// authClient.useSession is the source of truth for AuthProvider's context.
// Mock it so we can drive the session state deterministically.
const mockUseSession = jest.fn();
jest.mock('@/lib/auth-client', () => ({
  authClient: {
    useSession: () => mockUseSession(),
    $Infer: {},
  },
}));

import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/components/AuthProvider';

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-exports the provider-backed hook', () => {
    // Sanity: the hook imported from the hooks barrel is the same identity as
    // the one exported by AuthProvider (single source of truth).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fromProvider = require('@/components/AuthProvider').useAuth;
    expect(useAuth).toBe(fromProvider);
  });

  it('throws when used outside an AuthProvider', () => {
    // Suppress the expected React error boundary noise.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
    spy.mockRestore();
  });

  it('returns the authenticated session from context', () => {
    const session = {
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      isPending: false,
      error: null,
    };
    mockUseSession.mockReturnValue(session);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.data).toEqual(session.data);
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('reflects the pending state from the session client', () => {
    mockUseSession.mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('surfaces an error from the session client', () => {
    const err = new Error('session failed');
    mockUseSession.mockReturnValue({
      data: null,
      isPending: false,
      error: err,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.error).toBe(err);
  });
});
