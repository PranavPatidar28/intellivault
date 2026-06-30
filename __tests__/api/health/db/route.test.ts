/**
 * Tests for Database Health API Route
 * GET /api/health/db — unauthenticated liveness probe that pings the DB.
 */

// Override the global @/lib/prisma mock (from jest.setup.ts) with one that
// exposes the named `pingDatabase` export this route depends on.
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  pingDatabase: jest.fn(),
  default: {},
}));

import { GET } from '@/app/api/health/db/route';
import { pingDatabase } from '@/lib/prisma';

const mockPing = pingDatabase as jest.Mock;

describe('Health API - GET /api/health/db', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with status "up" when the database responds', async () => {
    mockPing.mockResolvedValue(true);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, status: 'up' });
    expect(mockPing).toHaveBeenCalledTimes(1);
  });

  it('should return 503 with status "down" when the database is unreachable', async () => {
    mockPing.mockResolvedValue(false);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toEqual({ ok: false, status: 'down' });
  });

  it('does not require authentication (no session lookup involved)', async () => {
    mockPing.mockResolvedValue(true);

    // GET takes no request/headers; simply succeeds based on the ping result.
    const response = await GET();
    expect(response.status).toBe(200);
  });
});
