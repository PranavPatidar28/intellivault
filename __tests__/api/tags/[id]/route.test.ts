/**
 * Tests for Tag [id] API Routes
 * Covers PATCH (update), DELETE (soft delete), and GET (single tag) on /api/tags/[id]
 */

import { PATCH, DELETE, GET } from '@/app/api/tags/[id]/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';
import { Prisma } from '@/generated/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

const recordNotFoundError = () =>
  new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: '1.0.0',
  });

describe('Tag [id] API - PATCH /api/tags/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await PATCH(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.tag.update).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid body (name too long)', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'a'.repeat(101) }),
    });

    const response = await PATCH(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
  });

  it('should return 400 for invalid field types', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'PATCH',
      body: JSON.stringify({ isFavorite: 'yes' }),
    });

    const response = await PATCH(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should update a tag name and derive slug', async () => {
    setAuthenticatedUser();

    const mockTag = {
      id: 'tag-1',
      name: 'Updated Tag',
      slug: 'updated-tag',
      color: '#ef4444',
      description: null,
      isFavorite: false,
      isArchived: false,
      lastUsed: new Date(),
      createdAt: new Date(),
      deletedAt: null,
      _count: { notes: 3 },
    };

    mockPrismaClient.tag.update.mockResolvedValue(mockTag);

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Tag' }),
    });

    const response = await PATCH(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tag.name).toBe('Updated Tag');
    expect(data.tag.usageCount).toBe(3);

    // Verify slug was derived and ownership scoping applied
    const callArg = mockPrismaClient.tag.update.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 'tag-1', userId: 'test-user-id' });
    expect(callArg.data.name).toBe('Updated Tag');
    expect(callArg.data.slug).toBe('updated-tag');
  });

  it('should update color, description, isFavorite and isArchived fields', async () => {
    setAuthenticatedUser();

    const mockTag = {
      id: 'tag-1',
      name: 'Tag',
      slug: 'tag',
      color: '#00ff00',
      description: 'A description',
      isFavorite: true,
      isArchived: true,
      lastUsed: new Date(),
      createdAt: new Date(),
      deletedAt: null,
      _count: { notes: 0 },
    };

    mockPrismaClient.tag.update.mockResolvedValue(mockTag);

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'PATCH',
      body: JSON.stringify({
        color: '#00ff00',
        description: 'A description',
        isFavorite: true,
        isArchived: true,
      }),
    });

    const response = await PATCH(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tag.color).toBe('#00ff00');
    expect(data.tag.description).toBe('A description');
    expect(data.tag.isFavorite).toBe(true);
    expect(data.tag.isArchived).toBe(true);

    // name not provided => slug should not be in the update payload
    const callArg = mockPrismaClient.tag.update.mock.calls[0][0];
    expect(callArg.data.name).toBeUndefined();
    expect(callArg.data.slug).toBeUndefined();
    expect(callArg.data.color).toBe('#00ff00');
  });

  it('should allow setting description to null', async () => {
    setAuthenticatedUser();

    const mockTag = {
      id: 'tag-1',
      name: 'Tag',
      slug: 'tag',
      color: null,
      description: null,
      isFavorite: false,
      isArchived: false,
      lastUsed: new Date(),
      createdAt: new Date(),
      deletedAt: null,
      _count: { notes: 0 },
    };

    mockPrismaClient.tag.update.mockResolvedValue(mockTag);

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'PATCH',
      body: JSON.stringify({ description: null }),
    });

    const response = await PATCH(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    const callArg = mockPrismaClient.tag.update.mock.calls[0][0];
    expect(callArg.data.description).toBeNull();
  });

  it('should return 404 when the tag does not exist (P2025)', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.update.mockRejectedValue(recordNotFoundError());

    const request = new NextRequest('http://localhost:3000/api/tags/missing', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New' }),
    });

    const response = await PATCH(request, makeParams('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Tag not found');
  });

  it('should return 500 on unexpected database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New' }),
    });

    const response = await PATCH(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update tag');
  });
});

describe('Tag [id] API - DELETE /api/tags/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.tag.update).not.toHaveBeenCalled();
  });

  it('should soft-delete a tag by setting deletedAt', async () => {
    setAuthenticatedUser();

    const deletedTag = {
      id: 'tag-1',
      name: 'Tag',
      slug: 'tag',
      deletedAt: new Date(),
    };

    mockPrismaClient.tag.update.mockResolvedValue(deletedTag);

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tag.deletedAt).toBeTruthy();

    const callArg = mockPrismaClient.tag.update.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 'tag-1', userId: 'test-user-id' });
    expect(callArg.data.deletedAt).toBeInstanceOf(Date);
  });

  it('should return 404 when the tag does not exist (P2025)', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.update.mockRejectedValue(recordNotFoundError());

    const request = new NextRequest('http://localhost:3000/api/tags/missing', {
      method: 'DELETE',
    });

    const response = await DELETE(request, makeParams('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Tag not found');
  });

  it('should return 500 on unexpected database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.update.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete tag');
  });
});

describe('Tag [id] API - GET /api/tags/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.tag.findFirst).not.toHaveBeenCalled();
  });

  it('should fetch a single tag with notes and usage count', async () => {
    setAuthenticatedUser();

    const mockTag = {
      id: 'tag-1',
      name: 'Tag',
      slug: 'tag',
      color: '#ef4444',
      description: 'desc',
      isFavorite: true,
      isArchived: false,
      lastUsed: new Date(),
      createdAt: new Date(),
      deletedAt: null,
      _count: { notes: 2 },
      notes: [
        {
          id: 'note-1',
          title: 'Note 1',
          contentText: 'text',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    mockPrismaClient.tag.findFirst.mockResolvedValue(mockTag);

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tag.id).toBe('tag-1');
    expect(data.tag.usageCount).toBe(2);
    expect(data.tag.notes).toHaveLength(1);

    const callArg = mockPrismaClient.tag.findFirst.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 'tag-1', userId: 'test-user-id' });
  });

  it('should return 404 when the tag is not found', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/tags/missing');

    const response = await GET(request, makeParams('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Tag not found');
  });

  it('should return 500 on database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/tags/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch tag');
  });
});
