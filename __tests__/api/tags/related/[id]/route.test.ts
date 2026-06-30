/**
 * Tests for Related Tags API Route
 * GET /api/tags/related/[id] — computes related tags by co-occurrence on shared notes
 */

import { GET } from '@/app/api/tags/related/[id]/route';
import { NextRequest } from 'next/server';
import '../../../../mocks/prisma';
import '../../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../../mocks/auth';
import mockPrismaClient from '../../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Related Tags API - GET /api/tags/related/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags/related/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.note.findMany).not.toHaveBeenCalled();
  });

  it('should return an empty list when the tag has no notes', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.tag.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/tags/related/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.relatedTags).toEqual([]);

    // Notes are scoped to the user and the target tag
    expect(mockPrismaClient.note.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'test-user-id',
        tags: { some: { id: 'tag-1', userId: 'test-user-id' } },
      },
      include: { tags: { select: { id: true } } },
    });
    // No related ids were collected so the lookup uses an empty `in`
    expect(mockPrismaClient.tag.findMany).toHaveBeenCalledWith({
      where: { id: { in: [] }, userId: 'test-user-id' },
    });
  });

  it('should count co-occurrences and attach strength, excluding the target tag', async () => {
    setAuthenticatedUser();

    // tag-1 is the target; tag-2 co-occurs twice, tag-3 once
    mockPrismaClient.note.findMany.mockResolvedValue([
      { id: 'n1', tags: [{ id: 'tag-1' }, { id: 'tag-2' }, { id: 'tag-3' }] },
      { id: 'n2', tags: [{ id: 'tag-1' }, { id: 'tag-2' }] },
    ]);
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { id: 'tag-2', name: 'Two' },
      { id: 'tag-3', name: 'Three' },
    ]);

    const request = new NextRequest('http://localhost:3000/api/tags/related/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // The findMany for related tags should have been queried with the
    // co-occurring ids, sorted by count descending.
    const relatedCall = mockPrismaClient.tag.findMany.mock.calls[0][0];
    expect(relatedCall.where.id.in).toEqual(['tag-2', 'tag-3']);
    expect(relatedCall.where.userId).toBe('test-user-id');

    // Strength values map back to the co-occurrence counts.
    const byId: Record<string, number> = {};
    for (const entry of data.relatedTags) {
      byId[entry.tag.id] = entry.strength;
    }
    expect(byId['tag-2']).toBe(2);
    expect(byId['tag-3']).toBe(1);

    // The target tag must never appear among related tags.
    expect(data.relatedTags.some((e: any) => e.tag.id === 'tag-1')).toBe(false);
  });

  it('should limit related tags to the top 10 by co-occurrence', async () => {
    setAuthenticatedUser();

    // Build 12 distinct co-occurring tags, each appearing a decreasing number
    // of times so ordering is deterministic.
    const notes: any[] = [];
    for (let i = 1; i <= 12; i++) {
      // tag-i co-occurs (13 - i) times -> tag-1 most frequent ... tag-12 least
      for (let n = 0; n < 13 - i; n++) {
        notes.push({ id: `note-${i}-${n}`, tags: [{ id: 'target' }, { id: `tag-${i}` }] });
      }
    }

    mockPrismaClient.note.findMany.mockResolvedValue(notes);
    mockPrismaClient.tag.findMany.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/tags/related/target');

    await GET(request, makeParams('target'));

    const relatedCall = mockPrismaClient.tag.findMany.mock.calls[0][0];
    const ids: string[] = relatedCall.where.id.in;
    expect(ids).toHaveLength(10);
    // Top of the list is the most frequent co-occurring tag.
    expect(ids[0]).toBe('tag-1');
    // The two least frequent (tag-11, tag-12) should be dropped.
    expect(ids).not.toContain('tag-11');
    expect(ids).not.toContain('tag-12');
  });

  it('should return 500 when note.findMany rejects', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findMany.mockRejectedValue(new Error('DB down'));

    const request = new NextRequest('http://localhost:3000/api/tags/related/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch related tags');
  });

  it('should return 500 when the related tag.findMany rejects', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findMany.mockResolvedValue([
      { id: 'n1', tags: [{ id: 'tag-1' }, { id: 'tag-2' }] },
    ]);
    mockPrismaClient.tag.findMany.mockRejectedValue(new Error('lookup failed'));

    const request = new NextRequest('http://localhost:3000/api/tags/related/tag-1');

    const response = await GET(request, makeParams('tag-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch related tags');
  });
});
