/**
 * Tests for Tag Batch API Route
 * Covers POST /api/tags/batch — bulk delete/recolor/archive/unarchive/favorite.
 */

import { POST } from '@/app/api/tags/batch/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/tags/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('Tag Batch API - POST /api/tags/batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // batch uses tag.updateMany which isn't on the shared mock by default
    mockPrismaClient.tag.updateMany = jest.fn();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(
      makeRequest({ tagIds: ['a'], operation: 'delete' })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.tag.updateMany).not.toHaveBeenCalled();
  });

  it('should return 400 when tagIds is empty (validation)', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ tagIds: [], operation: 'delete' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
  });

  it('should return 400 for an unknown operation (validation)', async () => {
    setAuthenticatedUser();

    const response = await POST(
      makeRequest({ tagIds: ['a'], operation: 'explode' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should soft-delete tags scoped to the caller', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.updateMany.mockResolvedValue({ count: 2 });

    const response = await POST(
      makeRequest({ tagIds: ['a', 'b'], operation: 'delete' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deletedCount).toBe(2);

    const callArg = mockPrismaClient.tag.updateMany.mock.calls[0][0];
    expect(callArg.where).toEqual({
      id: { in: ['a', 'b'] },
      userId: 'test-user-id',
    });
    expect(callArg.data.deletedAt).toBeInstanceOf(Date);
  });

  it('should recolor tags when a color is provided', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.updateMany.mockResolvedValue({ count: 3 });

    const response = await POST(
      makeRequest({ tagIds: ['a', 'b', 'c'], operation: 'recolor', color: '#123456' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.updatedCount).toBe(3);

    const callArg = mockPrismaClient.tag.updateMany.mock.calls[0][0];
    expect(callArg.data.color).toBe('#123456');
  });

  it('should return 400 for recolor without a color', async () => {
    setAuthenticatedUser();

    const response = await POST(
      makeRequest({ tagIds: ['a'], operation: 'recolor' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Color is required for recolor operation');
    expect(mockPrismaClient.tag.updateMany).not.toHaveBeenCalled();
  });

  it('should archive tags', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      makeRequest({ tagIds: ['a'], operation: 'archive' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.updatedCount).toBe(1);
    expect(mockPrismaClient.tag.updateMany.mock.calls[0][0].data).toEqual({
      isArchived: true,
    });
  });

  it('should unarchive tags', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.updateMany.mockResolvedValue({ count: 1 });

    const response = await POST(
      makeRequest({ tagIds: ['a'], operation: 'unarchive' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.updatedCount).toBe(1);
    expect(mockPrismaClient.tag.updateMany.mock.calls[0][0].data).toEqual({
      isArchived: false,
    });
  });

  it('should favorite tags', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.updateMany.mockResolvedValue({ count: 4 });

    const response = await POST(
      makeRequest({ tagIds: ['a', 'b', 'c', 'd'], operation: 'favorite' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.updatedCount).toBe(4);
    expect(mockPrismaClient.tag.updateMany.mock.calls[0][0].data).toEqual({
      isFavorite: true,
    });
  });

  it('should return 500 on database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.updateMany.mockRejectedValue(new Error('Database error'));

    const response = await POST(
      makeRequest({ tagIds: ['a'], operation: 'delete' })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to perform batch operation');
  });
});
