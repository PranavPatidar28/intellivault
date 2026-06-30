/**
 * Tests for Tag Analytics API Route
 * GET /api/tags/analytics — aggregates tag stats for the authenticated user.
 */

import { GET } from '@/app/api/tags/analytics/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/tags/analytics');
}

/**
 * The route fires (in order):
 *  count, count, count, count,           -> total/active/archived/orphaned
 *  findMany (mostUsed), findMany (recent), findMany (usageRows),
 *  count (lastWeek), count (previousWeek)
 * We use mockResolvedValueOnce in that exact call order.
 */
function primeHappyPath(opts?: {
  lastWeek?: number;
  previousWeek?: number;
  usageRows?: Array<{ lastUsed: Date | null }>;
  mostUsed?: any[];
  recent?: any[];
}) {
  const lastWeek = opts?.lastWeek ?? 4;
  const previousWeek = opts?.previousWeek ?? 2;

  mockPrismaClient.tag.count
    .mockResolvedValueOnce(10) // totalTags
    .mockResolvedValueOnce(8) // activeTags
    .mockResolvedValueOnce(2) // archivedTags
    .mockResolvedValueOnce(3) // orphanedTags
    .mockResolvedValueOnce(lastWeek) // lastWeekCount
    .mockResolvedValueOnce(previousWeek); // previousWeekCount

  mockPrismaClient.tag.findMany
    .mockResolvedValueOnce(
      opts?.mostUsed ?? [
        {
          id: 't1',
          name: 'Popular',
          _count: { notes: 9 },
        },
      ]
    ) // mostUsedTags
    .mockResolvedValueOnce(opts?.recent ?? [{ id: 'r1', name: 'Fresh' }]) // recentlyCreated
    .mockResolvedValueOnce(opts?.usageRows ?? []); // usageRows
}

describe('Tag Analytics API - GET /api/tags/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns aggregated analytics on the happy path', async () => {
    setAuthenticatedUser();
    primeHappyPath();

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.analytics.totalTags).toBe(10);
    expect(data.analytics.activeTags).toBe(8);
    expect(data.analytics.archivedTags).toBe(2);
    expect(data.analytics.orphanedTags).toBe(3);
    expect(data.analytics.recentlyCreated).toHaveLength(1);
  });

  it('shapes mostUsedTags with count and strips _count', async () => {
    setAuthenticatedUser();
    primeHappyPath({
      mostUsed: [{ id: 't1', name: 'Popular', _count: { notes: 12 } }],
    });

    const response = await GET(makeRequest());
    const data = await response.json();

    const top = data.analytics.mostUsedTags[0];
    expect(top.count).toBe(12);
    expect(top.tag.name).toBe('Popular');
    expect(top.tag._count).toBeUndefined();
  });

  it('always returns a 31-entry usageOverTime series', async () => {
    setAuthenticatedUser();
    primeHappyPath({ usageRows: [] });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.analytics.usageOverTime).toHaveLength(31);
    expect(data.analytics.usageOverTime.every((p: any) => p.count === 0)).toBe(true);
    expect(data.analytics.usageOverTime[0]).toHaveProperty('date');
  });

  it('buckets lastUsed timestamps into the usage series and ignores nulls', async () => {
    setAuthenticatedUser();
    const today = new Date();
    primeHappyPath({
      usageRows: [{ lastUsed: today }, { lastUsed: today }, { lastUsed: null }],
    });

    const response = await GET(makeRequest());
    const data = await response.json();

    const total = data.analytics.usageOverTime.reduce(
      (sum: number, p: any) => sum + p.count,
      0
    );
    // Two non-null rows dated today should bucket into the last entry.
    expect(total).toBe(2);
    expect(data.analytics.usageOverTime[30].count).toBe(2);
  });

  it('computes positive percentChange in tag growth', async () => {
    setAuthenticatedUser();
    primeHappyPath({ lastWeek: 4, previousWeek: 2 });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.analytics.tagGrowth.thisWeek).toBe(4);
    expect(data.analytics.tagGrowth.lastWeek).toBe(2);
    expect(data.analytics.tagGrowth.percentChange).toBe(100);
  });

  it('reports 0 percentChange when previous week was zero (no divide-by-zero)', async () => {
    setAuthenticatedUser();
    primeHappyPath({ lastWeek: 5, previousWeek: 0 });

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(data.analytics.tagGrowth.percentChange).toBe(0);
  });

  it('scopes every query to the authenticated user with deletedAt null', async () => {
    setAuthenticatedUser();
    primeHappyPath();

    await GET(makeRequest());

    const firstCountWhere = mockPrismaClient.tag.count.mock.calls[0][0].where;
    expect(firstCountWhere.userId).toBe('test-user-id');
    expect(firstCountWhere.deletedAt).toBeNull();
  });

  it('returns 500 when an aggregate query rejects', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.count.mockRejectedValue(new Error('db down'));
    mockPrismaClient.tag.findMany.mockRejectedValue(new Error('db down'));

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch tag analytics');
  });
});
