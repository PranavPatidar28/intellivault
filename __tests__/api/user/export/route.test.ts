/**
 * Tests for User Data Export API Route
 * Tests POST operation on /api/user/export
 */

import { POST } from '@/app/api/user/export/route';
import '../../../mocks/prisma';
import mockPrismaClient from '../../../mocks/prisma';
import { mockAuthenticatedSession } from '../../../mocks/auth';

jest.mock('@/lib/session', () => ({
  requireAuth: jest.fn(),
}));

import { requireAuth } from '@/lib/session';

const mockRequireAuth = requireAuth as jest.Mock;

const setAuthenticated = () =>
  mockRequireAuth.mockResolvedValue(mockAuthenticatedSession);
const setUnauthenticated = () =>
  mockRequireAuth.mockRejectedValue(new Error('Unauthorized'));

const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  image: null,
  createdAt: new Date('2024-01-01'),
};

const buildNote = (overrides = {}) => ({
  id: 'note-1',
  title: 'Note 1',
  userId: 'test-user-id',
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-03'),
  pinnedAt: null,
  lastEmbeddedAt: null,
  aiProcessedAt: null,
  tags: [{ id: 't1', name: 'Tag', slug: 'tag', color: '#fff' }],
  attachments: [
    {
      id: 'a1',
      url: 'https://blob/x',
      filename: 'x.png',
      mimeType: 'image/png',
      fileType: 'image',
      size: 100,
    },
  ],
  ...overrides,
});

const buildTag = (overrides = {}) => ({
  id: 't1',
  name: 'Tag',
  userId: 'test-user-id',
  createdAt: new Date('2024-01-02'),
  updatedAt: new Date('2024-01-03'),
  lastUsed: new Date('2024-01-04'),
  deletedAt: null,
  parent: null,
  children: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrismaClient.userPreferences = {
    findUnique: jest.fn(),
  };
});

describe('User Export API - POST /api/user/export', () => {
  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should export all user data with statistics', async () => {
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaClient.note.findMany.mockResolvedValue([buildNote()]);
    mockPrismaClient.tag.findMany.mockResolvedValue([buildTag()]);
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'test-user-id',
      theme: 'dark',
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.version).toBe('1.0');
    expect(typeof data.exportedAt).toBe('string');
    expect(data.user.email).toBe('test@example.com');
    expect(data.user.preferences.theme).toBe('dark');
    expect(data.notes).toHaveLength(1);
    expect(data.tags).toHaveLength(1);
    expect(data.statistics).toEqual({
      totalNotes: 1,
      totalTags: 1,
      totalAttachments: 1,
    });
    // Dates are serialized to ISO strings
    expect(typeof data.notes[0].createdAt).toBe('string');
    expect(data.notes[0].pinnedAt).toBeNull();
    expect(typeof data.tags[0].lastUsed).toBe('string');
  });

  it('should return a successful JSON export response', async () => {
    // NOTE: the route sets a Content-Disposition attachment header, but the
    // test env's polyfilled Response.json (jest.setup.ts) overwrites the
    // headers object, so that header is not observable here. We assert on the
    // status/body the polyfill does preserve instead.
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.tag.findMany.mockResolvedValue([]);
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.version).toBe('1.0');
  });

  it('should handle empty data sets', async () => {
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.tag.findMany.mockResolvedValue([]);
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.notes).toEqual([]);
    expect(data.tags).toEqual([]);
    expect(data.statistics).toEqual({
      totalNotes: 0,
      totalTags: 0,
      totalAttachments: 0,
    });
    expect(data.user.preferences).toBeNull();
  });

  it('should serialize optional note dates when present', async () => {
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaClient.note.findMany.mockResolvedValue([
      buildNote({
        pinnedAt: new Date('2024-02-01'),
        lastEmbeddedAt: new Date('2024-02-02'),
        aiProcessedAt: new Date('2024-02-03'),
        attachments: [],
      }),
    ]);
    mockPrismaClient.tag.findMany.mockResolvedValue([
      buildTag({ deletedAt: new Date('2024-02-05') }),
    ]);
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.notes[0].pinnedAt).toBe('string');
    expect(typeof data.notes[0].lastEmbeddedAt).toBe('string');
    expect(typeof data.notes[0].aiProcessedAt).toBe('string');
    expect(typeof data.tags[0].deletedAt).toBe('string');
    expect(data.statistics.totalAttachments).toBe(0);
  });

  it('should aggregate attachment counts across notes', async () => {
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaClient.note.findMany.mockResolvedValue([
      buildNote({ id: 'n1', attachments: [{ id: 'a1' }, { id: 'a2' }] }),
      buildNote({ id: 'n2', attachments: [{ id: 'a3' }] }),
    ]);
    mockPrismaClient.tag.findMany.mockResolvedValue([]);
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);

    const response = await POST();
    const data = await response.json();

    expect(data.statistics.totalAttachments).toBe(3);
    expect(data.statistics.totalNotes).toBe(2);
  });

  it('should return 500 on database error', async () => {
    setAuthenticated();
    mockPrismaClient.user.findUnique.mockRejectedValue(new Error('DB error'));
    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.tag.findMany.mockResolvedValue([]);
    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to export data');
  });
});
