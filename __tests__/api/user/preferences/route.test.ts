/**
 * Tests for User Preferences API Routes
 * Tests GET and PATCH operations on /api/user/preferences
 */

import { GET, PATCH } from '@/app/api/user/preferences/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import mockPrismaClient from '../../../mocks/prisma';
import { mockAuthenticatedSession } from '../../../mocks/auth';
import { DEFAULT_PREFERENCES } from '@/types/settings';

jest.mock('@/lib/session', () => ({
  requireAuth: jest.fn(),
}));

import { requireAuth } from '@/lib/session';

const mockRequireAuth = requireAuth as jest.Mock;

const setAuthenticated = () =>
  mockRequireAuth.mockResolvedValue(mockAuthenticatedSession);
const setUnauthenticated = () =>
  mockRequireAuth.mockRejectedValue(new Error('Unauthorized'));

// userPreferences is not on the shared prisma mock; add it per-file.
beforeEach(() => {
  mockPrismaClient.userPreferences = {
    findUnique: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  };
});

const buildExistingPrefs = (overrides = {}) => ({
  id: 'pref-1',
  userId: 'test-user-id',
  ...DEFAULT_PREFERENCES,
  ...overrides,
});

describe('User Preferences API - GET /api/user/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.userPreferences = {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    };
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return existing preferences', async () => {
    setAuthenticated();
    const prefs = buildExistingPrefs({ theme: 'dark' });
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(prefs);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.theme).toBe('dark');
    expect(mockPrismaClient.userPreferences.create).not.toHaveBeenCalled();
  });

  it('should create defaults when none exist', async () => {
    setAuthenticated();
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);
    const created = buildExistingPrefs();
    mockPrismaClient.userPreferences.create.mockResolvedValue(created);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.theme).toBe('system');
    expect(mockPrismaClient.userPreferences.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'test-user-id',
          ...DEFAULT_PREFERENCES,
        }),
      })
    );
  });

  it('should return 500 on database error', async () => {
    setAuthenticated();
    mockPrismaClient.userPreferences.findUnique.mockRejectedValue(
      new Error('DB error')
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch preferences');
  });
});

describe('User Preferences API - PATCH /api/user/preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.userPreferences = {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    };
  });

  const buildRequest = (body: unknown) =>
    new NextRequest('http://localhost:3000/api/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const response = await PATCH(buildRequest({ theme: 'dark' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should update valid preferences via upsert', async () => {
    setAuthenticated();
    const updated = buildExistingPrefs({ theme: 'dark', fontSize: 'large' });
    mockPrismaClient.userPreferences.upsert.mockResolvedValue(updated);

    const response = await PATCH(
      buildRequest({ theme: 'dark', fontSize: 'large' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.theme).toBe('dark');
    expect(data.fontSize).toBe('large');
    expect(mockPrismaClient.userPreferences.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'test-user-id' },
        update: { theme: 'dark', fontSize: 'large' },
      })
    );
  });

  it('should merge defaults on create branch of upsert', async () => {
    setAuthenticated();
    mockPrismaClient.userPreferences.upsert.mockResolvedValue(
      buildExistingPrefs({ aiAutoTag: true })
    );

    await PATCH(buildRequest({ aiAutoTag: true }));

    const call = mockPrismaClient.userPreferences.upsert.mock.calls[0][0];
    expect(call.create).toEqual(
      expect.objectContaining({
        userId: 'test-user-id',
        ...DEFAULT_PREFERENCES,
        aiAutoTag: true,
      })
    );
  });

  it('should return 400 for an invalid enum value', async () => {
    setAuthenticated();

    const response = await PATCH(buildRequest({ theme: 'neon' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(Array.isArray(data.details)).toBe(true);
    expect(mockPrismaClient.userPreferences.upsert).not.toHaveBeenCalled();
  });

  it('should return 400 for unknown keys (strict whitelist)', async () => {
    setAuthenticated();

    const response = await PATCH(
      buildRequest({ userId: 'hacker', id: 'x', theme: 'dark' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(mockPrismaClient.userPreferences.upsert).not.toHaveBeenCalled();
  });

  it('should return 400 for out-of-range autoSaveInterval', async () => {
    setAuthenticated();

    const response = await PATCH(buildRequest({ autoSaveInterval: 99999 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 for wrong type on boolean field', async () => {
    setAuthenticated();

    const response = await PATCH(buildRequest({ showWordCount: 'yes' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should accept nullable provider fields', async () => {
    setAuthenticated();
    mockPrismaClient.userPreferences.upsert.mockResolvedValue(
      buildExistingPrefs({ defaultLLMProvider: null })
    );

    const response = await PATCH(
      buildRequest({ defaultLLMProvider: null, defaultLLMModel: null })
    );

    expect(response.status).toBe(200);
    expect(mockPrismaClient.userPreferences.upsert).toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    setAuthenticated();
    mockPrismaClient.userPreferences.upsert.mockRejectedValue(
      new Error('DB error')
    );

    const response = await PATCH(buildRequest({ theme: 'dark' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update preferences');
  });
});
