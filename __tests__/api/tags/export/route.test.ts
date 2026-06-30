/**
 * Tests for Tags Export API Route
 * POST /api/tags/export — exports a user's tags as JSON or CSV.
 */

import { POST } from '@/app/api/tags/export/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/tags/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const sampleTag = {
  id: 'tag-1',
  name: 'Work',
  slug: 'work',
  color: '#ef4444',
  description: 'work stuff',
  isFavorite: true,
  isArchived: false,
  createdAt: new Date('2024-01-15T00:00:00.000Z'),
  parent: { id: 'p1', name: 'Parent Tag' },
  _count: { notes: 7 },
};

describe('Tags Export API - POST /api/tags/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(makeRequest({ format: 'json' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.tag.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid format', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ format: 'xml' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
  });

  it('returns 400 when format is missing', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ includeArchived: true }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 when tagIds exceeds the max of 5000', async () => {
    setAuthenticatedUser();

    const tagIds = Array.from({ length: 5001 }, (_, i) => `t${i}`);
    const response = await POST(makeRequest({ format: 'json', tagIds }));

    expect(response.status).toBe(400);
  });

  it('exports tags as JSON (happy path)', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([sampleTag]);

    const response = await POST(makeRequest({ format: 'json' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.filename).toMatch(/^tags-export-\d{4}-\d{2}-\d{2}\.json$/);

    const parsed = JSON.parse(data.data);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      name: 'Work',
      slug: 'work',
      color: '#ef4444',
      description: 'work stuff',
      parentName: 'Parent Tag',
      isFavorite: true,
      isArchived: false,
      usageCount: 7,
    });
  });

  it('exports JSON with null parentName when tag has no parent', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { ...sampleTag, parent: null },
    ]);

    const response = await POST(makeRequest({ format: 'json' }));
    const data = await response.json();
    const parsed = JSON.parse(data.data);

    expect(parsed[0].parentName).toBeNull();
  });

  it('exports tags as CSV with a header row and escaped cells', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([sampleTag]);

    const response = await POST(makeRequest({ format: 'csv' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.filename).toMatch(/\.csv$/);

    const lines = data.data.split('\n');
    expect(lines[0]).toBe(
      'Name,Slug,Color,Description,Parent,Favorite,Archived,Usage Count,Created At'
    );
    expect(lines[1]).toContain('"Work"');
    expect(lines[1]).toContain('"work stuff"');
    expect(lines[1]).toContain('"Parent Tag"');
    expect(lines[1]).toContain('2024-01-15T00:00:00.000Z');
  });

  it('neutralizes CSV formula-injection prefixes', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([
      {
        ...sampleTag,
        name: '=cmd|calc',
        description: '+danger',
        parent: null,
      },
    ]);

    const response = await POST(makeRequest({ format: 'csv' }));
    const data = await response.json();
    const row = data.data.split('\n')[1];

    // Leading =/+ should be prefixed with a single quote inside the quoted cell.
    expect(row).toContain('"\'=cmd|calc"');
    expect(row).toContain('"\'+danger"');
  });

  it('escapes embedded double quotes in CSV cells', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { ...sampleTag, name: 'a"b', parent: null },
    ]);

    const response = await POST(makeRequest({ format: 'csv' }));
    const data = await response.json();
    const row = data.data.split('\n')[1];

    expect(row).toContain('"a""b"');
  });

  it('scopes the query to the caller and applies default deleted/archived filters', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([]);

    await POST(makeRequest({ format: 'json' }));

    const where = mockPrismaClient.tag.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('test-user-id');
    expect(where.deletedAt).toBeNull();
    expect(where.isArchived).toBe(false);
    expect(where.id).toBeUndefined();
  });

  it('filters by tagIds when provided', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([]);

    await POST(makeRequest({ format: 'json', tagIds: ['a', 'b'] }));

    const where = mockPrismaClient.tag.findMany.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ['a', 'b'] });
  });

  it('omits deleted/archived filters when includeDeleted and includeArchived are true', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([]);

    await POST(
      makeRequest({ format: 'json', includeDeleted: true, includeArchived: true })
    );

    const where = mockPrismaClient.tag.findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeUndefined();
    expect(where.isArchived).toBeUndefined();
  });

  it('returns 500 when prisma rejects', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockRejectedValue(new Error('db down'));

    const response = await POST(makeRequest({ format: 'json' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to export tags');
  });
});
