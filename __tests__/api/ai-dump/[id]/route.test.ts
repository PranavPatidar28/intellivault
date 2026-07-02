/**
 * Tests for AI Dump [id] API Routes
 * Tests GET (fetch one draft) and DELETE (delete a draft) on /api/ai-dump/[id]
 */

import { GET, DELETE } from '@/app/api/ai-dump/[id]/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Helper to build the params promise the route expects
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const fullNote = {
  id: 'note-1',
  userId: 'test-user-id',
  title: 'My Draft',
  rawText: 'raw text',
  contentText: '# generated md',
  titles: [{ variant: 'short', text: 'My Draft', score: 0.9 }],
  tags: [{ id: 't1', name: 'tag1' }],
  tldr: 'tldr',
  summary: 'summary',
  actions: [],
  embeddingsMeta: { status: 'done' },
  versions: [],
  status: 'DRAFT',
  provenance: { llm_model: 'm' },
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

describe('AI Dump API - GET /api/ai-dump/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump/note-1');
    const response = await GET(request, ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns the mapped note on the happy path', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(fullNote);

    const request = new NextRequest('http://localhost:3000/api/ai-dump/note-1');
    const response = await GET(request, ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.id).toBe('note-1');
    // contentText is exposed as generatedMd
    expect(data.note.generatedMd).toBe('# generated md');
    // embeddingsMeta is exposed as embeddings
    expect(data.note.embeddings).toEqual({ status: 'done' });
    expect(data.note.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(data.note.updatedAt).toBe('2024-01-02T00:00:00.000Z');

    // Scoped to the authenticated user
    const findArgs = mockPrismaClient.note.findFirst.mock.calls[0][0];
    expect(findArgs.where).toEqual({ id: 'note-1', userId: 'test-user-id' });
    expect(findArgs.include).toEqual({ tags: true });
  });

  it('returns 404 when the note does not exist', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/ai-dump/missing');
    const response = await GET(request, ctx('missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('returns 500 when the query throws', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockRejectedValue(new Error('DB error'));

    const request = new NextRequest('http://localhost:3000/api/ai-dump/note-1');
    const response = await GET(request, ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch AI Dump');
  });
});

describe('AI Dump API - DELETE /api/ai-dump/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump/note-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.note.delete).not.toHaveBeenCalled();
  });

  it('deletes an owned draft on the happy path', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(fullNote);
    mockPrismaClient.note.delete.mockResolvedValue(fullNote);

    const request = new NextRequest('http://localhost:3000/api/ai-dump/note-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Draft deleted successfully');

    // Only DRAFT status notes can be deleted
    const findArgs = mockPrismaClient.note.findFirst.mock.calls[0][0];
    expect(findArgs.where.status).toBe('DRAFT');
    expect(mockPrismaClient.note.delete).toHaveBeenCalledWith({
      where: { id: 'note-1' },
    });
  });

  it('returns 404 when the draft is not found or not owned', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/ai-dump/note-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Draft not found or not authorized');
    expect(mockPrismaClient.note.delete).not.toHaveBeenCalled();
  });

  it('returns 500 when delete throws', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(fullNote);
    mockPrismaClient.note.delete.mockRejectedValue(new Error('DB error'));

    const request = new NextRequest('http://localhost:3000/api/ai-dump/note-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete AI Dump');
  });
});
