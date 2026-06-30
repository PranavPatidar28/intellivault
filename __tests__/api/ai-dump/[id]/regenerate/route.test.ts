/**
 * Tests for AI Dump regenerate API Route
 * Tests POST /api/ai-dump/[id]/regenerate — regenerates a single section.
 */

import { POST } from '@/app/api/ai-dump/[id]/regenerate/route';
import { NextRequest } from 'next/server';
import '../../../../mocks/prisma';
import '../../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../../mocks/auth';
import mockPrismaClient from '../../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

jest.mock('@/lib/ai/ai-dump-service', () => ({
  regenerateSection: jest.fn(),
}));

import { regenerateSection } from '@/lib/ai/ai-dump-service';

const mockRegenerate = regenerateSection as jest.Mock;

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const draftNote = {
  id: 'note-1',
  userId: 'test-user-id',
  rawText: 'raw text for regeneration',
  contentText: '# current markdown',
  titles: [{ variant: 'short', text: 'Old', score: 0.9 }],
  actions: [],
  versions: [],
  status: 'DRAFT',
};

const req = (id: string, body: unknown) =>
  new NextRequest(`http://localhost:3000/api/ai-dump/${id}/regenerate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('AI Dump API - POST /api/ai-dump/[id]/regenerate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(req('note-1', { section: 'titles' }), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('returns 400 when section is invalid', async () => {
    setAuthenticatedUser();

    const response = await POST(
      req('note-1', { section: 'nonsense' }),
      ctx('note-1')
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
    expect(mockPrismaClient.note.findFirst).not.toHaveBeenCalled();
  });

  it('returns 404 when draft is not found', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const response = await POST(req('note-1', { section: 'titles' }), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Draft not found or not authorized');
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('returns 400 when the draft has no raw text', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue({
      ...draftNote,
      rawText: null,
    });

    const response = await POST(req('note-1', { section: 'titles' }), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No raw text available for regeneration');
    expect(mockRegenerate).not.toHaveBeenCalled();
  });

  it('regenerates titles and stores a version snapshot', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    const regenerated = {
      titles: [{ variant: 'short', text: 'New Title', score: 0.95 }],
    };
    mockRegenerate.mockResolvedValue(regenerated);
    mockPrismaClient.note.update.mockResolvedValue({});

    const response = await POST(req('note-1', { section: 'titles' }), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.updatedSection).toEqual(regenerated);
    expect(data.versionId).toMatch(/^v_\d+_/);

    const updateArgs = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'note-1' });
    expect(updateArgs.data.titles).toEqual(regenerated.titles);
    // A version snapshot is appended
    expect(updateArgs.data.versions).toHaveLength(1);
    expect(updateArgs.data.versions[0].section).toBe('titles');

    // The service receives the raw text + current markdown context
    expect(mockRegenerate).toHaveBeenCalledWith(
      'titles',
      'raw text for regeneration',
      'test-user-id',
      expect.any(Object),
      expect.objectContaining({ currentMarkdown: '# current markdown' })
    );
  });

  it('regenerates markdown and updates contentText', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    mockRegenerate.mockResolvedValue({ markdown: '# brand new markdown' });
    mockPrismaClient.note.update.mockResolvedValue({});

    const response = await POST(
      req('note-1', { section: 'markdown', instruction: 'Make it shorter' }),
      ctx('note-1')
    );
    expect(response.status).toBe(200);

    const updateArgs = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArgs.data.contentText).toBe('# brand new markdown');
    expect(mockRegenerate).toHaveBeenCalledWith(
      'markdown',
      expect.any(String),
      'test-user-id',
      expect.any(Object),
      expect.objectContaining({ instruction: 'Make it shorter' })
    );
  });

  it('regenerates actions and updates the actions field', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    const actions = [
      { text: 'New action', assignee: 'me', due_date: null, confidence: 0.8 },
    ];
    mockRegenerate.mockResolvedValue({ actions });
    mockPrismaClient.note.update.mockResolvedValue({});

    const response = await POST(req('note-1', { section: 'actions' }), ctx('note-1'));
    expect(response.status).toBe(200);

    const updateArgs = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArgs.data.actions).toEqual(actions);
  });

  it('regenerates tags and connects them via connectOrCreate', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    mockRegenerate.mockResolvedValue({
      tags: [{ name: 'Alpha', confidence: 0.9 }, { name: 'Beta', confidence: 0.7 }],
    });
    mockPrismaClient.note.update.mockResolvedValue({});

    const response = await POST(req('note-1', { section: 'tags' }), ctx('note-1'));
    expect(response.status).toBe(200);

    const updateArgs = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArgs.data.tags.set).toEqual([]);
    expect(updateArgs.data.tags.connectOrCreate).toHaveLength(2);
    expect(updateArgs.data.tags.connectOrCreate[0].create.name).toBe('Alpha');
  });

  it('returns 500 when the service throws', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(draftNote);
    mockRegenerate.mockRejectedValue(new Error('LLM failed'));

    const response = await POST(req('note-1', { section: 'titles' }), ctx('note-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to regenerate section');
    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
  });
});
