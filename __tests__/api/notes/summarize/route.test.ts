/**
 * Tests for Summarization API Routes
 * Tests POST (generate summary, with caching + multimodal branches) and
 * GET (lightweight title generation) on /api/notes/summarize
 */

import { POST, GET } from '@/app/api/notes/summarize/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock the AI barrel the route pulls all its summarization helpers from.
jest.mock('@/lib/ai', () => ({
  generateSummary: jest.fn(),
  generateSummaryMultimodal: jest.fn(),
  generateTitle: jest.fn(),
  generateContentHash: jest.fn(),
  hasContentChanged: jest.fn(),
  extractContentFromJSON: jest.fn(),
  validateContentForSummary: jest.fn(),
  prepareMultimodalContent: jest.fn(),
  needsMultimodalProcessing: jest.fn(),
}));

import {
  generateSummary,
  generateSummaryMultimodal,
  generateTitle,
  generateContentHash,
  hasContentChanged,
  extractContentFromJSON,
  validateContentForSummary,
  prepareMultimodalContent,
  needsMultimodalProcessing,
} from '@/lib/ai';

const mockGenerateSummary = generateSummary as jest.Mock;
const mockGenerateSummaryMultimodal = generateSummaryMultimodal as jest.Mock;
const mockGenerateTitle = generateTitle as jest.Mock;
const mockGenerateContentHash = generateContentHash as jest.Mock;
const mockHasContentChanged = hasContentChanged as jest.Mock;
const mockExtractContentFromJSON = extractContentFromJSON as jest.Mock;
const mockValidateContentForSummary = validateContentForSummary as jest.Mock;
const mockPrepareMultimodalContent = prepareMultimodalContent as jest.Mock;
const mockNeedsMultimodalProcessing = needsMultimodalProcessing as jest.Mock;

const baseNote = {
  id: 'note-1',
  title: 'My Note',
  contentJSON: { type: 'doc', content: [] },
  contentText: 'Some body text',
  summary: null,
  contentHash: 'old-hash',
};

const makePost = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/notes/summarize', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('Summarize API - POST /api/notes/summarize', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Sensible defaults: validation passes, content unchanged check is fresh,
    // and text-only path unless a test opts into multimodal.
    mockExtractContentFromJSON.mockReturnValue({ text: 'Some body text', images: [] });
    mockValidateContentForSummary.mockReturnValue({ canSummarize: true });
    mockGenerateContentHash.mockReturnValue('new-hash');
    mockHasContentChanged.mockReturnValue(true);
    mockNeedsMultimodalProcessing.mockReturnValue(false);
    mockPrismaClient.note.findUnique.mockResolvedValue(baseNote);
    mockPrismaClient.note.update.mockResolvedValue({});
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(makePost({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when noteId is missing', async () => {
    setAuthenticatedUser();

    const response = await POST(makePost({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 for an invalid options enum value', async () => {
    setAuthenticatedUser();

    const response = await POST(makePost({ noteId: 'note-1', options: { length: 'huge' } }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 404 when the note does not exist', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findUnique.mockResolvedValue(null);

    const response = await POST(makePost({ noteId: 'missing' }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('should return 400 when content cannot be summarized', async () => {
    setAuthenticatedUser();
    mockValidateContentForSummary.mockReturnValue({
      canSummarize: false,
      message: 'Note is empty',
      suggestion: 'Add some text',
      suggestMultimodal: true,
    });

    const response = await POST(makePost({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Note is empty');
    expect(data.suggestMultimodal).toBe(true);
  });

  it('should return cached summary when content is unchanged and not forced', async () => {
    setAuthenticatedUser();
    mockHasContentChanged.mockReturnValue(false);
    mockPrismaClient.note.findUnique.mockResolvedValue({
      ...baseNote,
      summary: 'Existing summary',
    });

    const response = await POST(makePost({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cached).toBe(true);
    expect(data.summary).toBe('Existing summary');
    expect(mockGenerateSummary).not.toHaveBeenCalled();
    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
  });

  it('should re-summarize unchanged content when force is true', async () => {
    setAuthenticatedUser();
    mockHasContentChanged.mockReturnValue(false);
    mockPrismaClient.note.findUnique.mockResolvedValue({
      ...baseNote,
      summary: 'Existing summary',
    });
    mockGenerateSummary.mockResolvedValue({
      summary: 'Fresh summary',
      contentHash: 'new-hash',
      keywords: ['k'],
      confidence: 0.9,
      provider: 'openai',
      latencyMs: 100,
    });

    const response = await POST(makePost({ noteId: 'note-1', options: { force: true } }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cached).toBe(false);
    expect(data.summary).toBe('Fresh summary');
    expect(mockGenerateSummary).toHaveBeenCalled();
  });

  it('should generate a text-only summary on the happy path', async () => {
    setAuthenticatedUser();
    mockGenerateSummary.mockResolvedValue({
      summary: 'Generated summary',
      generatedTitle: 'A Title',
      contentHash: 'new-hash',
      keywords: ['alpha', 'beta'],
      confidence: 0.8,
      provider: 'openai',
      latencyMs: 200,
    });

    const response = await POST(makePost({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.cached).toBe(false);
    expect(data.summary).toBe('Generated summary');
    expect(data.generatedTitle).toBe('A Title');
    expect(data.multimodal).toBe(false);
    expect(mockGenerateSummaryMultimodal).not.toHaveBeenCalled();

    // generatedTitle should be persisted alongside summary fields.
    const updateArg = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'note-1' });
    expect(updateArg.data.summary).toBe('Generated summary');
    expect(updateArg.data.generatedTitle).toBe('A Title');
  });

  it('should not persist generatedTitle when none is produced', async () => {
    setAuthenticatedUser();
    mockGenerateSummary.mockResolvedValue({
      summary: 'Generated summary',
      contentHash: 'new-hash',
      keywords: [],
      confidence: 0.8,
      provider: 'openai',
      latencyMs: 200,
    });

    await POST(makePost({ noteId: 'note-1' }));

    const updateArg = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArg.data).not.toHaveProperty('generatedTitle');
  });

  it('should use the multimodal path when images are present', async () => {
    setAuthenticatedUser();
    mockNeedsMultimodalProcessing.mockReturnValue(true);
    mockPrepareMultimodalContent.mockResolvedValue([{ type: 'text', text: 'hi' }]);
    mockGenerateSummaryMultimodal.mockResolvedValue({
      summary: 'Multimodal summary',
      contentHash: 'new-hash',
      keywords: [],
      confidence: 0.7,
      provider: 'openai',
      latencyMs: 300,
    });

    const response = await POST(
      makePost({ noteId: 'note-1', context: { includeImages: true } })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary).toBe('Multimodal summary');
    expect(data.multimodal).toBe(true);
    expect(mockGenerateSummaryMultimodal).toHaveBeenCalled();
    expect(mockGenerateSummary).not.toHaveBeenCalled();
  });

  it('should return 400 when multimodal content cannot be prepared', async () => {
    setAuthenticatedUser();
    mockNeedsMultimodalProcessing.mockReturnValue(true);
    mockPrepareMultimodalContent.mockResolvedValue([]);

    const response = await POST(
      makePost({ noteId: 'note-1', context: { includeImages: true } })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to prepare content for summarization.');
    expect(mockGenerateSummaryMultimodal).not.toHaveBeenCalled();
  });

  it('should return 500 when summary generation throws', async () => {
    setAuthenticatedUser();
    mockGenerateSummary.mockRejectedValue(new Error('LLM failure'));

    const response = await POST(makePost({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate summary');
  });
});

describe('Summarize API - GET /api/notes/summarize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeGet = (query: string) =>
    new NextRequest(`http://localhost:3000/api/notes/summarize${query}`);

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await GET(makeGet('?noteId=note-1'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when noteId query param is missing', async () => {
    setAuthenticatedUser();

    const response = await GET(makeGet(''));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Note ID is required');
  });

  it('should return 404 when the note is not found', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findUnique.mockResolvedValue(null);

    const response = await GET(makeGet('?noteId=missing'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('should generate a title on the happy path', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findUnique.mockResolvedValue({ contentText: 'Body text' });
    mockGenerateTitle.mockResolvedValue({ title: 'Smart Title', provider: 'openai' });

    const response = await GET(makeGet('?noteId=note-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.title).toBe('Smart Title');
    expect(data.provider).toBe('openai');
  });

  it('should return 500 when title generation throws', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findUnique.mockResolvedValue({ contentText: 'Body text' });
    mockGenerateTitle.mockRejectedValue(new Error('boom'));

    const response = await GET(makeGet('?noteId=note-1'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate title');
  });
});
