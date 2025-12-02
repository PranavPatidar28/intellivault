// Mock authentication for testing
// The actual mock is defined in jest.setup.ts to avoid importing better-auth

export const mockAuthenticatedSession = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
  },
  session: {
    id: 'test-session-id',
    expiresAt: new Date(Date.now() + 86400000),
    token: 'test-token',
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    userId: 'test-user-id',
  },
};

export const mockUnauthenticatedSession = null;

// Get the mock auth from global (set in jest.setup.ts)
export const mockAuth = (global as any).mockAuth;

// Helper to set authenticated state
export const setAuthenticatedUser = () => {
  mockAuth.api.getSession.mockResolvedValue(mockAuthenticatedSession);
};

// Helper to set unauthenticated state
export const setUnauthenticatedUser = () => {
  mockAuth.api.getSession.mockResolvedValue(mockUnauthenticatedSession);
};

// Reset auth mocks
export const resetAuthMocks = () => {
  mockAuth.api.getSession.mockReset();
  mockAuth.api.signIn.mockReset();
  mockAuth.api.signOut.mockReset();
  mockAuth.api.signUp.mockReset();
};

