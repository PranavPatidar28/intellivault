/**
 * Tests for Tag Archive Toggle API Route
 * POST /api/tags/archive/[id] — toggles the isArchived flag on a tag
 */

import { POST } from '@/app/api/tags/archive/[id]/route';
import { NextRequest } from 'next/server';
import '../../../../mocks/prisma';
import '../../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../../mocks/auth';
import mockPrismaClient from '../../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Tags Archive API - POST /api/tags/archive/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/archive/tag-1', {
      method: 'POST',
    });

    const response = await POST(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.tag.findFirst).not.toHaveBeenCalled();
  });

  it('should return 404 when the tag does not exist for the user', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/tags/archive/missing', {
      method: 'POST',
    });

    const response = await POST(request, makeParams('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Tag not found');
    expect(mockPrismaClient.tag.update).not.toHaveBeenCalled();
  });

  it('should archive a tag that is currently not archived', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue({ isArchived: false });
    mockPrismaClient.tag.update.mockResolvedValue({
      id: 'tag-1',
      name: 'Work',
      isArchived: true,
    });

    const request = new NextRequest('http://localhost:3000/api/tags/archive/tag-1', {
      method: 'POST',
    });

    const response = await POST(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isArchived).toBe(true);
    expect(data.tag.id).toBe('tag-1');

    // Scoped to the authenticated user and toggled to the opposite value
    expect(mockPrismaClient.tag.findFirst).toHaveBeenCalledWith({
      where: { id: 'tag-1', userId: 'test-user-id' },
      select: { isArchived: true },
    });
    expect(mockPrismaClient.tag.update).toHaveBeenCalledWith({
      where: { id: 'tag-1', userId: 'test-user-id' },
      data: { isArchived: true },
    });
  });

  it('should unarchive a tag that is currently archived', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue({ isArchived: true });
    mockPrismaClient.tag.update.mockResolvedValue({
      id: 'tag-2',
      name: 'Personal',
      isArchived: false,
    });

    const request = new NextRequest('http://localhost:3000/api/tags/archive/tag-2', {
      method: 'POST',
    });

    const response = await POST(request, makeParams('tag-2'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isArchived).toBe(false);
    expect(mockPrismaClient.tag.update).toHaveBeenCalledWith({
      where: { id: 'tag-2', userId: 'test-user-id' },
      data: { isArchived: false },
    });
  });

  it('should return 500 when findFirst rejects', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockRejectedValue(new Error('DB down'));

    const request = new NextRequest('http://localhost:3000/api/tags/archive/tag-1', {
      method: 'POST',
    });

    const response = await POST(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to toggle archive');
  });

  it('should return 500 when update rejects', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue({ isArchived: false });
    mockPrismaClient.tag.update.mockRejectedValue(new Error('write failed'));

    const request = new NextRequest('http://localhost:3000/api/tags/archive/tag-1', {
      method: 'POST',
    });

    const response = await POST(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to toggle archive');
  });
});
