/**
 * Tests for User Profile API Routes
 * Tests GET and PATCH operations on /api/user/profile
 */

import { GET, PATCH } from '@/app/api/user/profile/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import mockPrismaClient from '../../../mocks/prisma';
import { mockAuthenticatedSession } from '../../../mocks/auth';

// Mock the session layer so we exercise the route's real 401 branch
// (requireAuth on no-session calls redirect(), not a thrown "Unauthorized").
jest.mock('@/lib/session', () => ({
  requireAuth: jest.fn(),
}));

import { requireAuth } from '@/lib/session';

const mockRequireAuth = requireAuth as jest.Mock;

const setAuthenticated = () =>
  mockRequireAuth.mockResolvedValue(mockAuthenticatedSession);
const setUnauthenticated = () =>
  mockRequireAuth.mockRejectedValue(new Error('Unauthorized'));

describe('User Profile API - GET /api/user/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should fetch the user profile', async () => {
    setAuthenticated();

    const mockUser = {
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      emailVerified: true,
      createdAt: new Date('2024-01-01'),
      accounts: [{ providerId: 'google', createdAt: new Date('2024-01-01') }],
    };
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe('test-user-id');
    expect(data.email).toBe('test@example.com');
    expect(data.accounts).toHaveLength(1);
    expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'test-user-id' } })
    );
  });

  it('should return 404 when the user does not exist', async () => {
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 500 on database error', async () => {
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockRejectedValue(new Error('DB error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch profile');
  });
});

describe('User Profile API - PATCH /api/user/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildRequest = (body: unknown) =>
    new NextRequest('http://localhost:3000/api/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const response = await PATCH(buildRequest({ name: 'New Name' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should update the name (trimmed)', async () => {
    setAuthenticated();
    const updated = {
      id: 'test-user-id',
      name: 'New Name',
      email: 'test@example.com',
      image: null,
      emailVerified: true,
      createdAt: new Date('2024-01-01'),
    };
    mockPrismaClient.user.update.mockResolvedValue(updated);

    const response = await PATCH(buildRequest({ name: '  New Name  ' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('New Name');
    expect(mockPrismaClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'test-user-id' },
        data: { name: 'New Name' },
      })
    );
  });

  it('should update the image', async () => {
    setAuthenticated();
    mockPrismaClient.user.update.mockResolvedValue({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://example.com/pic.png',
      emailVerified: true,
      createdAt: new Date('2024-01-01'),
    });

    const response = await PATCH(
      buildRequest({ image: 'https://example.com/pic.png' })
    );
    await response.json();

    expect(response.status).toBe(200);
    expect(mockPrismaClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { image: 'https://example.com/pic.png' },
      })
    );
  });

  it('should allow clearing the image with null', async () => {
    setAuthenticated();
    mockPrismaClient.user.update.mockResolvedValue({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      emailVerified: true,
      createdAt: new Date('2024-01-01'),
    });

    const response = await PATCH(buildRequest({ image: null }));
    await response.json();

    expect(response.status).toBe(200);
    expect(mockPrismaClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { image: null } })
    );
  });

  it('should return 400 when name is an empty string', async () => {
    setAuthenticated();

    const response = await PATCH(buildRequest({ name: '   ' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Name must be a non-empty string');
    expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
  });

  it('should return 400 when name is not a string', async () => {
    setAuthenticated();

    const response = await PATCH(buildRequest({ name: 123 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Name must be a non-empty string');
    expect(mockPrismaClient.user.update).not.toHaveBeenCalled();
  });

  it('should update with empty data when no fields are provided', async () => {
    setAuthenticated();
    mockPrismaClient.user.update.mockResolvedValue({
      id: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      image: null,
      emailVerified: true,
      createdAt: new Date('2024-01-01'),
    });

    const response = await PATCH(buildRequest({}));
    await response.json();

    expect(response.status).toBe(200);
    expect(mockPrismaClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: {} })
    );
  });

  it('should return 500 on database error', async () => {
    setAuthenticated();
    mockPrismaClient.user.update.mockRejectedValue(new Error('DB error'));

    const response = await PATCH(buildRequest({ name: 'New Name' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update profile');
  });
});
