/**
 * Tests for AI Dump finalize API Route
 * Tests POST /api/ai-dump/[id]/finalize — converts a draft to a FINAL note.
 */

import { POST } from '@/app/api/ai-dump/[id]/finalize/route';
import { NextRequest } from 'next/server';
import '../../../../mocks/prisma';
import '../../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../../mocks/auth';
import mockPrismaClient from '../../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Background re-embedding is dynamically imported by the route.
jest.mock('@/lib/ai/embedding-sync', () => ({
  embedNote: jest.fn().mockResolvedValue({ success: true }),
}));

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const draftNote = {
  id: 'note-1',
  userId: 'test-user-id',
  rawText: 'original raw text',
  status: 'DRAFT',
};

const validBody = {
  selectedTitle: 'Final Title',
  selectedTags: ['tag1', 'tag2'],
  finalMarkdown: '# Heading\n\nSome body content.',
  retainRaw: true,
};

const req = (id: string, body: unknown) =>
  new NextRequest(`http://localhost:3000/api/ai-dump/${id}/finalize`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('AI Dump API - POST /api/ai-dump/[id]/finalize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(req('note-1', validBody), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when validation fails (missing title)', async () => {
    setAuthenticatedUser();

    const response = await POST(
      req('note-1', { selectedTags: [], finalMarkdown: 'x' }),
      ctx('note-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
    expect(mockPrismaClient.note.findFirst).not.toHaveBeenCalled();
  });

  it('returns 400 when finalMarkdown is empty', async () => {
    setAuthenticatedUser();

    const response = await POST(
      req('note-1', { selectedTitle: 'T', selectedTags: [], finalMarkdown: '' }),
      ctx('note-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 404 when the draft is not found', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const response = await POST(req('note-1', validBody), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Draft not found or not authorized');
    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
  });

  it('finalizes a draft on the happy path and retains raw text', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    mockPrismaClient.note.update.mockResolvedValue({
      id: 'note-1',
      title: 'Final Title',
      status: 'FINAL',
      tags: [{ name: 'tag1' }, { name: 'tag2' }],
      updatedAt: new Date('2024-05-01T00:00:00.000Z'),
    });

    const response = await POST(req('note-1', validBody), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe('saved');
    expect(data.noteId).toBe('note-1');
    expect(data.note.title).toBe('Final Title');
    expect(data.note.tags).toEqual(['tag1', 'tag2']);
    expect(data.note.status).toBe('FINAL');

    const updateArgs = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'note-1' });
    expect(updateArgs.data.status).toBe('FINAL');
    expect(updateArgs.data.title).toBe('Final Title');
    // retainRaw true -> keep the original raw text
    expect(updateArgs.data.rawText).toBe('original raw text');
    // tags use connectOrCreate
    expect(updateArgs.data.tags.connectOrCreate).toHaveLength(2);
    // contentJSON is produced from markdown conversion (object, not null)
    expect(updateArgs.data.contentJSON).toBeDefined();
    expect(typeof updateArgs.data.contentText).toBe('string');
  });

  it('clears raw text when retainRaw is false', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    mockPrismaClient.note.update.mockResolvedValue({
      id: 'note-1',
      title: 'Final Title',
      status: 'FINAL',
      tags: [],
      updatedAt: new Date(),
    });

    const response = await POST(
      req('note-1', { ...validBody, retainRaw: false }),
      ctx('note-1')
    );
    expect(response.status).toBe(200);

    const updateArgs = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArgs.data.rawText).toBeNull();
  });

  it('handles an empty tags array', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    mockPrismaClient.note.update.mockResolvedValue({
      id: 'note-1',
      title: 'Final Title',
      status: 'FINAL',
      tags: [],
      updatedAt: new Date(),
    });

    const response = await POST(
      req('note-1', { ...validBody, selectedTags: [] }),
      ctx('note-1')
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.note.tags).toEqual([]);

    const updateArgs = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArgs.data.tags.connectOrCreate).toEqual([]);
  });

  it('returns 500 when the update throws', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    mockPrismaClient.note.update.mockRejectedValue(new Error('DB error'));

    const response = await POST(req('note-1', validBody), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to finalize AI Dump');
  });
});
