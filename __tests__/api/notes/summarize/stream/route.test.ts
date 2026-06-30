/**
 * Tests for Streaming Summarization API Route
 * Tests POST /api/notes/summarize/stream (Server-Sent Events).
 *
 * The streaming body itself is framework/runtime machinery, so the happy-path
 * assertions focus on observable contract: status code, SSE headers, and the
 * persistence side effect that the stream performs once drained. The non-stream
 * branches (auth, rate limit, validation, not-found, outer error) are tested
 * directly since they return plain JSON Responses.
 */

// The jsdom test environment doesn't reliably expose the Web streaming
// primitives the route uses at runtime (TextEncoder for SSE frame encoding and
// ReadableStream for the response body), so we install Node's implementations
// before the handler runs. Assign unconditionally: a partial jsdom global would
// otherwise leak through and break Response body construction.
import { TextEncoder as NodeTextEncoder } from 'util';
import { ReadableStream as NodeReadableStream } from 'stream/web';
(globalThis as { TextEncoder: unknown }).TextEncoder = NodeTextEncoder;
(globalThis as { ReadableStream: unknown }).ReadableStream = NodeReadableStream;

import { POST } from '@/app/api/notes/summarize/stream/route';
import { NextRequest } from 'next/server';
import '../../../../mocks/prisma';
import '../../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../../mocks/auth';
import mockPrismaClient from '../../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock rate-limit so we can drive the 429 branch deterministically.
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(),
  RATE_LIMITS: { ai: { limit: 20, windowMs: 60000 } },
}));

// Mock the summarization service (AI streaming).
jest.mock('@/lib/ai/summarization-service', () => ({
  generateSummaryStreamParts: jest.fn(),
  generateContentHash: jest.fn(() => 'content-hash'),
}));

import { checkRateLimit } from '@/lib/rate-limit';
import {
  generateSummaryStreamParts,
  generateContentHash,
} from '@/lib/ai/summarization-service';

const mockCheckRateLimit = checkRateLimit as jest.Mock;
const mockStreamParts = generateSummaryStreamParts as jest.Mock;
const mockGenerateContentHash = generateContentHash as jest.Mock;

const makePost = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/notes/summarize/stream', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// Build an async-generator factory yielding the given stream parts.
const streamFrom = (parts: Array<{ kind: string; value: string }>) =>
  // eslint-disable-next-line require-yield
  async function* () {
    for (const p of parts) {
      yield p;
    }
  };

// Poll across macrotasks until predicate is true (the stream's start() runs
// asynchronously and we need its side effects to settle).
const waitFor = async (predicate: () => boolean, tries = 50) => {
  for (let i = 0; i < tries; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 0));
  }
};

describe('Summarize Stream API - POST /api/notes/summarize/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ success: true, retryAfter: 0 });
    mockGenerateContentHash.mockReturnValue('content-hash');
    mockPrismaClient.note.findUnique.mockResolvedValue({
      id: 'note-1',
      title: 'My Note',
      contentText: 'Body text',
    });
    mockPrismaClient.note.update.mockResolvedValue({});
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(makePost({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 when rate limited', async () => {
    setAuthenticatedUser();
    mockCheckRateLimit.mockReturnValue({ success: false, retryAfter: 30 });

    const response = await POST(makePost({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Too many requests');
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

    const response = await POST(makePost({ noteId: 'note-1', options: { style: 'haiku' } }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 404 when the note is not found', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findUnique.mockResolvedValue(null);

    const response = await POST(makePost({ noteId: 'missing' }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('should return a 200 SSE stream and persist the accumulated summary', async () => {
    setAuthenticatedUser();
    mockStreamParts.mockImplementation(
      streamFrom([
        { kind: 'reasoning', value: 'thinking...' },
        { kind: 'text', value: 'Hello ' },
        { kind: 'text', value: 'world' },
      ])
    );

    const response = await POST(makePost({ noteId: 'note-1' }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    // The stream's start() runs asynchronously; wait for the persistence side effect.
    await waitFor(() => mockPrismaClient.note.update.mock.calls.length > 0);

    expect(mockPrismaClient.note.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'note-1' });
    // Only the text parts are persisted; reasoning is forwarded but not stored.
    expect(updateArg.data.summary).toBe('Hello world');
    expect(updateArg.data.contentHash).toBe('content-hash');
  });

  it('should NOT persist when only reasoning (empty text) is produced', async () => {
    setAuthenticatedUser();
    mockStreamParts.mockImplementation(
      streamFrom([{ kind: 'reasoning', value: 'just thinking' }])
    );

    const response = await POST(makePost({ noteId: 'note-1' }));
    expect(response.status).toBe(200);

    // Give the stream's start() a chance to run to completion.
    await waitFor(() => false, 5);

    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
  });

  it('should still return a 200 stream when generation throws mid-stream', async () => {
    setAuthenticatedUser();
    mockStreamParts.mockImplementation(async function* () {
      yield { kind: 'text', value: 'partial' };
      throw new Error('mid-stream failure');
    });

    const response = await POST(makePost({ noteId: 'note-1' }));

    // The error is surfaced as an SSE event inside the body, so the HTTP
    // response itself is still a 200 event-stream and no summary is persisted.
    expect(response.status).toBe(200);
    await waitFor(() => false, 5);
    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
  });

  it('should return 500 when the request body is not valid JSON', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes/summarize/stream', {
      method: 'POST',
      body: 'not-json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(typeof data.error).toBe('string');
  });
});
