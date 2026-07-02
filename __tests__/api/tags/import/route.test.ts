/**
 * Tests for Tags Import API Route
 * POST /api/tags/import — imports tags from JSON or CSV with merge/replace/skip.
 */

import { POST } from '@/app/api/tags/import/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Rate limiting is exercised separately; default to "allowed" for most tests.
jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(() => null),
  RATE_LIMITS: { ai: {}, upload: {}, bulk: {} },
}));

import { enforceRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/tags/import', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('Tags Import API - POST /api/tags/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceRateLimit as jest.Mock).mockReturnValue(null);
    // Default: no existing tags so the quota check passes.
    mockPrismaClient.tag.count.mockResolvedValue(0);
    mockPrismaClient.tag.findUnique.mockResolvedValue(null);
    mockPrismaClient.tag.create.mockResolvedValue({ id: 'new' });
    mockPrismaClient.tag.update.mockResolvedValue({ id: 'upd' });
    mockPrismaClient.$transaction.mockResolvedValue([{}, {}]);
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(
      makeRequest({ data: '[]', format: 'json' })
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 429 when rate limited', async () => {
    setAuthenticatedUser();
    (enforceRateLimit as jest.Mock).mockReturnValue(
      NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    );

    const response = await POST(
      makeRequest({ data: '[{"name":"x"}]', format: 'json' })
    );

    expect(response.status).toBe(429);
    expect(mockPrismaClient.tag.create).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body (missing format)', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ data: '[]' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 for empty data string', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ data: '', format: 'json' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 for invalid JSON content', async () => {
    setAuthenticatedUser();

    const response = await POST(
      makeRequest({ data: '{not json', format: 'json' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON in import data');
  });

  it('returns 400 when JSON is not an array', async () => {
    setAuthenticatedUser();

    const response = await POST(
      makeRequest({ data: '{"name":"x"}', format: 'json' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Import data must be a JSON array of tags');
  });

  it('returns 400 when no tags are found', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ data: '[]', format: 'json' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No tags found in import data');
  });

  it('returns 400 when more than 1000 tags are supplied', async () => {
    setAuthenticatedUser();
    const many = JSON.stringify(
      Array.from({ length: 1001 }, (_, i) => ({ name: `tag${i}` }))
    );

    const response = await POST(makeRequest({ data: many, format: 'json' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Too many tags/);
  });

  it('returns 400 when a tag fails shape validation', async () => {
    setAuthenticatedUser();
    // name is required (min 1); empty name fails importTagSchema.
    const response = await POST(
      makeRequest({ data: '[{"name":""}]', format: 'json' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('One or more tags are invalid');
    expect(data.details).toBeDefined();
  });

  it('returns 400 when import would exceed per-user quota', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.count.mockResolvedValue(5000);

    const response = await POST(
      makeRequest({ data: '[{"name":"one"}]', format: 'json' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/exceed the maximum/);
  });

  it('creates new tags on the happy path', async () => {
    setAuthenticatedUser();

    const response = await POST(
      makeRequest({
        data: JSON.stringify([
          { name: 'Alpha', color: '#fff' },
          { name: 'Beta' },
        ]),
        format: 'json',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.imported).toBe(2);
    expect(data.skipped).toBe(0);
    expect(mockPrismaClient.tag.create).toHaveBeenCalledTimes(2);
  });

  it('skips existing tags when strategy is skip', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findUnique.mockResolvedValue({ id: 'existing' });

    const response = await POST(
      makeRequest({
        data: JSON.stringify([{ name: 'Alpha' }]),
        format: 'json',
        strategy: 'skip',
      })
    );
    const data = await response.json();

    expect(data.imported).toBe(0);
    expect(data.skipped).toBe(1);
    expect(mockPrismaClient.tag.create).not.toHaveBeenCalled();
    expect(mockPrismaClient.tag.update).not.toHaveBeenCalled();
  });

  it('updates existing tags when strategy is merge (default)', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findUnique.mockResolvedValue({ id: 'existing' });

    const response = await POST(
      makeRequest({
        data: JSON.stringify([{ name: 'Alpha', color: '#000' }]),
        format: 'json',
      })
    );
    const data = await response.json();

    expect(data.imported).toBe(1);
    expect(mockPrismaClient.tag.update).toHaveBeenCalledTimes(1);
    expect(mockPrismaClient.tag.create).not.toHaveBeenCalled();
  });

  it('deletes and recreates existing tags when strategy is replace', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findUnique.mockResolvedValue({ id: 'existing' });

    const response = await POST(
      makeRequest({
        data: JSON.stringify([{ name: 'Alpha' }]),
        format: 'json',
        strategy: 'replace',
      })
    );
    const data = await response.json();

    expect(data.imported).toBe(1);
    expect(mockPrismaClient.$transaction).toHaveBeenCalledTimes(1);
  });

  it('records per-tag errors without failing the whole import', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.create
      .mockResolvedValueOnce({ id: 'ok' })
      .mockRejectedValueOnce(new Error('unique constraint'));

    const response = await POST(
      makeRequest({
        data: JSON.stringify([{ name: 'Good' }, { name: 'Bad' }]),
        format: 'json',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toMatch(/Bad/);
  });

  it('parses CSV imports (skipping the header row)', async () => {
    setAuthenticatedUser();
    const csv = [
      'Name,Slug,Color,Description,Parent,Favorite,Archived',
      'Work,work,#ef4444,desc,,true,false',
      'Home,home,#00ff00,house,,false,false',
    ].join('\n');

    const response = await POST(makeRequest({ data: csv, format: 'csv' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imported).toBe(2);
    expect(mockPrismaClient.tag.create).toHaveBeenCalledTimes(2);

    const firstCreate = mockPrismaClient.tag.create.mock.calls[0][0].data;
    expect(firstCreate.name).toBe('Work');
    expect(firstCreate.isFavorite).toBe(true);
    expect(firstCreate.userId).toBe('test-user-id');
  });

  it('returns 400 when a CSV has only a header (no data rows)', async () => {
    setAuthenticatedUser();

    const response = await POST(
      makeRequest({ data: 'Name,Slug,Color', format: 'csv' })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No tags found in import data');
  });

  it('returns 500 when the quota count query rejects', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.count.mockRejectedValue(new Error('db down'));

    const response = await POST(
      makeRequest({ data: '[{"name":"x"}]', format: 'json' })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to import tags');
  });
});
