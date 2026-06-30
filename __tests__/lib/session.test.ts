import '../mocks/auth';
import {
  setAuthenticatedUser,
  setUnauthenticatedUser,
  mockAuthenticatedSession,
} from '../mocks/auth';

// next/headers is already mocked in jest.setup.ts to return a resolved Headers.
// Override next/navigation locally so we can assert on redirect(). The global
// setup mock only provides hook stubs (useRouter etc.), not redirect.
const redirectMock = jest.fn((url: string) => {
  // Real Next redirect() throws to halt rendering; emulate that so code after
  // the call doesn't run.
  throw new Error(`NEXT_REDIRECT:${url}`);
});

jest.mock('next/navigation', () => ({
  redirect: (url: string) => redirectMock(url),
}));

import { getServerSession, requireAuth } from '@/lib/session';

describe('session helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getServerSession', () => {
    it('returns the session when authenticated', async () => {
      setAuthenticatedUser();
      const session = await getServerSession();
      expect(session).toEqual(mockAuthenticatedSession);
      expect(session?.user.id).toBe('test-user-id');
    });

    it('returns null when unauthenticated', async () => {
      setUnauthenticatedUser();
      const session = await getServerSession();
      expect(session).toBeNull();
    });

    it('propagates errors from the auth API', async () => {
      const mockAuth = (global as any).mockAuth;
      mockAuth.api.getSession.mockRejectedValueOnce(new Error('auth down'));
      await expect(getServerSession()).rejects.toThrow('auth down');
    });
  });

  describe('requireAuth', () => {
    it('returns the session when authenticated and does not redirect', async () => {
      setAuthenticatedUser();
      const session = await requireAuth();
      expect(session).toEqual(mockAuthenticatedSession);
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it('redirects to /signin when unauthenticated', async () => {
      setUnauthenticatedUser();
      await expect(requireAuth()).rejects.toThrow('NEXT_REDIRECT:/signin');
      expect(redirectMock).toHaveBeenCalledWith('/signin');
    });
  });
});
