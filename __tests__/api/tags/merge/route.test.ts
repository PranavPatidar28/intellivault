/**
 * Tests for Tag Merge API Route
 * Covers POST /api/tags/merge — merging source tags into a target tag.
 */

import { POST } from '@/app/api/tags/merge/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

describe('Tag Merge API - POST /api/tags/merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // merge uses tag.updateMany which isn't on the shared mock by default
    mockPrismaClient.tag.updateMany = jest.fn();
    // $transaction resolves to an array of operation results when passed an array
    mockPrismaClient.$transaction.mockResolvedValue([]);
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceTagIds: ['a'], targetTagId: 'b' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('should return 400 when sourceTagIds is empty (validation)', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceTagIds: [], targetTagId: 'b' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
  });

  it('should return 400 when required fields are missing (validation)', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceTagIds: ['a'] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when merging a tag only into itself', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceTagIds: ['same'], targetTagId: 'same' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe(
      'No source tags to merge (cannot merge a tag into itself)'
    );
    expect(mockPrismaClient.tag.findFirst).not.toHaveBeenCalled();
  });

  it('should return 404 when the target tag is not found', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceTagIds: ['a'], targetTagId: 'b' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Target tag not found');

    // Target lookup should be scoped to the caller
    const callArg = mockPrismaClient.tag.findFirst.mock.calls[0][0];
    expect(callArg.where).toEqual({ id: 'b', userId: 'test-user-id' });
    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('should merge source tags into target and reassign notes', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue({
      id: 'target',
      userId: 'test-user-id',
    });

    mockPrismaClient.tag.findMany.mockResolvedValue([
      {
        id: 'src-1',
        notes: [{ id: 'note-1' }, { id: 'note-2' }],
      },
      {
        id: 'src-2',
        // note-2 is shared across sources, must be deduped
        notes: [{ id: 'note-2' }, { id: 'note-3' }],
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({
        sourceTagIds: ['src-1', 'src-2'],
        targetTagId: 'target',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // 3 unique note ids (note-1, note-2, note-3)
    expect(data.mergedNotesCount).toBe(3);

    expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
    const ops = mockPrismaClient.$transaction.mock.calls[0][0];
    expect(Array.isArray(ops)).toBe(true);
    // 3 note updates + updateMany (soft delete) + target touch = 5 ops
    expect(ops).toHaveLength(5);

    // source tag lookup scoped to caller
    const findManyArg = mockPrismaClient.tag.findMany.mock.calls[0][0];
    expect(findManyArg.where.userId).toBe('test-user-id');
    expect(findManyArg.where.id.in).toEqual(['src-1', 'src-2']);
  });

  it('should exclude the target id from the source set before merging', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue({
      id: 'target',
      userId: 'test-user-id',
    });
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { id: 'src-1', notes: [{ id: 'note-1' }] },
    ]);

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({
        // target appears in sources, must be filtered out
        sourceTagIds: ['src-1', 'target'],
        targetTagId: 'target',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mergedNotesCount).toBe(1);

    // findMany should only query the non-target source ids
    const findManyArg = mockPrismaClient.tag.findMany.mock.calls[0][0];
    expect(findManyArg.where.id.in).toEqual(['src-1']);
  });

  it('should report zero merged notes when sources have no notes', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue({
      id: 'target',
      userId: 'test-user-id',
    });
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { id: 'src-1', notes: [] },
    ]);

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({
        sourceTagIds: ['src-1'],
        targetTagId: 'target',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mergedNotesCount).toBe(0);

    // Only updateMany + target touch, no note updates
    const ops = mockPrismaClient.$transaction.mock.calls[0][0];
    expect(ops).toHaveLength(2);
  });

  it('should return 500 when the transaction fails', async () => {
    setAuthenticatedUser();

    mockPrismaClient.tag.findFirst.mockResolvedValue({
      id: 'target',
      userId: 'test-user-id',
    });
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { id: 'src-1', notes: [{ id: 'note-1' }] },
    ]);
    mockPrismaClient.$transaction.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/tags/merge', {
      method: 'POST',
      body: JSON.stringify({
        sourceTagIds: ['src-1'],
        targetTagId: 'target',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to merge tags');
  });
});
