/**
 * Tests for AI Dump API Routes
 * Tests POST (create draft + AI pipeline) and GET (list drafts) on /api/ai-dump
 */

import { POST, GET } from '@/app/api/ai-dump/route';
import { NextRequest } from 'next/server';
import '../../mocks/prisma';
import '../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../mocks/auth';
import mockPrismaClient from '../../mocks/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock the AI pipeline so no real LLM calls are made
jest.mock('@/lib/ai/ai-dump-service', () => ({
  processAIDump: jest.fn(),
}));

// Mock the background embedding (dynamically imported by the route)
jest.mock('@/lib/ai/embedding-sync', () => ({
  embedNote: jest.fn().mockResolvedValue({ success: true }),
}));

import { processAIDump } from '@/lib/ai/ai-dump-service';

const mockProcessAIDump = processAIDump as jest.Mock;

const aiResult = {
  titles: [
    { variant: 'short', text: 'Short Title', score: 0.9 },
    { variant: 'descriptive', text: 'A Descriptive Title', score: 0.8 },
  ],
  tags: [{ name: 'tag1', confidence: 0.9 }],
  tldr: 'A short summary.',
  summary: 'A longer summary.',
  markdown: '# Heading\n\nBody text.',
  actions: [{ text: 'Do thing', assignee: 'me', due_date: null, confidence: 0.7 }],
  provenance: {
    llm_model: 'test-model',
    prompt_template_id: 'tpl-1',
    temperature: 0.2,
    generatedAt: new Date().toISOString(),
  },
};

describe('AI Dump API - POST /api/ai-dump', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({ content: 'hello world' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockProcessAIDump).not.toHaveBeenCalled();
  });

  it('creates a draft note on the happy path and returns generated content', async () => {
    setAuthenticatedUser();
    mockProcessAIDump.mockResolvedValue(aiResult);
    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-abc' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({ content: 'some raw content', source: 'paste' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.noteId).toBe('note-abc');
    expect(data.generated.markdown).toBe(aiResult.markdown);
    expect(data.generated.tags).toEqual(aiResult.tags);
    expect(data.warnings).toEqual([]);
    expect(data.errors).toEqual([]);
    expect(mockProcessAIDump).toHaveBeenCalledWith(
      'some raw content',
      'test-user-id',
      expect.any(Object)
    );

    // Selected title should prefer the "short" variant
    const createArgs = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArgs.data.title).toBe('Short Title');
    expect(createArgs.data.status).toBe('DRAFT');
    expect(createArgs.data.rawText).toBe('some raw content');
    expect(createArgs.data.userId).toBe('test-user-id');
  });

  it('falls back to the first title when no short variant exists', async () => {
    setAuthenticatedUser();
    mockProcessAIDump.mockResolvedValue({
      ...aiResult,
      titles: [{ variant: 'descriptive', text: 'Only Title', score: 0.8 }],
    });
    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-def' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({ content: 'content here' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createArgs = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArgs.data.title).toBe('Only Title');
  });

  it('falls back to "Untitled" when no titles are generated', async () => {
    setAuthenticatedUser();
    mockProcessAIDump.mockResolvedValue({ ...aiResult, titles: [] });
    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-ghi' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({ content: 'content here' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createArgs = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArgs.data.title).toBe('Untitled');
  });

  it('returns 400 when validation fails (empty body, nothing provided)', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
    expect(mockProcessAIDump).not.toHaveBeenCalled();
  });

  it('returns 400 when content is an empty string (fails min(1))', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({ content: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('persists originalFilename from metadata when provided', async () => {
    setAuthenticatedUser();
    mockProcessAIDump.mockResolvedValue(aiResult);
    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-meta' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({
        content: 'content',
        source: 'upload',
        metadata: { originalFilename: 'notes.txt' },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const createArgs = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArgs.data.originalFilename).toBe('notes.txt');
    expect(createArgs.data.source).toBe('upload');
  });

  it('returns 500 when the AI pipeline throws', async () => {
    setAuthenticatedUser();
    mockProcessAIDump.mockRejectedValue(new Error('LLM exploded'));

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({ content: 'content' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to process AI Dump');
    expect(mockPrismaClient.note.create).not.toHaveBeenCalled();
  });

  it('returns 500 when note creation throws', async () => {
    setAuthenticatedUser();
    mockProcessAIDump.mockResolvedValue(aiResult);
    mockPrismaClient.note.create.mockRejectedValue(new Error('DB down'));

    const request = new NextRequest('http://localhost:3000/api/ai-dump', {
      method: 'POST',
      body: JSON.stringify({ content: 'content' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to process AI Dump');
  });
});

describe('AI Dump API - GET /api/ai-dump', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // deleteMany is not on the shared prisma mock; add it for the cleanup step.
    mockPrismaClient.note.deleteMany = jest.fn();
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('lists drafts with default pagination and runs cleanup', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.deleteMany.mockResolvedValue({ count: 0 });
    const drafts = [
      {
        id: '1',
        title: 'Draft 1',
        tldr: 'tldr',
        source: 'paste',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockPrismaClient.note.findMany.mockResolvedValue(drafts);
    mockPrismaClient.note.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/ai-dump');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notes).toHaveLength(1);
    expect(data.metadata.page).toBe(1);
    expect(data.metadata.limit).toBe(10);
    expect(data.metadata.total).toBe(1);
    expect(data.metadata.totalPages).toBe(1);
    expect(mockPrismaClient.note.deleteMany).toHaveBeenCalled();

    // Only DRAFT notes are listed
    const findArgs = mockPrismaClient.note.findMany.mock.calls[0][0];
    expect(findArgs.where.status).toBe('DRAFT');
    expect(findArgs.where.userId).toBe('test-user-id');
  });

  it('honors custom pagination and caps limit at 50', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.note.count.mockResolvedValue(120);

    const request = new NextRequest(
      'http://localhost:3000/api/ai-dump?page=2&limit=100'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metadata.page).toBe(2);
    expect(data.metadata.limit).toBe(50); // capped
    expect(data.metadata.total).toBe(120);
    expect(data.metadata.totalPages).toBe(3); // ceil(120/50)

    const findArgs = mockPrismaClient.note.findMany.mock.calls[0][0];
    expect(findArgs.take).toBe(50);
    expect(findArgs.skip).toBe(50); // (2-1)*50
  });

  it('still lists drafts when cleanup deleteMany fails (non-fatal)', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.deleteMany.mockRejectedValue(new Error('cleanup fail'));
    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.note.count.mockResolvedValue(0);

    const request = new NextRequest('http://localhost:3000/api/ai-dump');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.notes).toEqual([]);
  });

  it('returns 500 when listing query fails', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.deleteMany.mockResolvedValue({ count: 0 });
    mockPrismaClient.note.findMany.mockRejectedValue(new Error('DB error'));
    mockPrismaClient.note.count.mockRejectedValue(new Error('DB error'));

    const request = new NextRequest('http://localhost:3000/api/ai-dump');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch AI Dumps');
  });
});
