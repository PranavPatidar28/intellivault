/**
 * @jest-environment node
 *
 * Tests for AI Dump Stream API Route
 * Tests POST /api/ai-dump/stream — SSE streaming of AI Dump processing
 *
 * Runs under the Node test environment because the route uses TextEncoder and
 * TransformStream (web streams) that jsdom does not provide.
 */

import { POST } from '@/app/api/ai-dump/stream/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock rate limiting so we control allow/deny per test. Default = allow.
jest.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { ai: { limit: 20, windowMs: 60_000 } },
  checkRateLimit: jest.fn(() => ({
    success: true,
    limit: 20,
    remaining: 19,
    retryAfter: 0,
  })),
}));

// Mock the streaming service generator.
jest.mock('@/lib/ai/ai-dump-service', () => ({
  processAIDumpStream: jest.fn(),
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { processAIDumpStream } from '@/lib/ai/ai-dump-service';

// The global Response is polyfilled with node-fetch's in jest.setup, which
// serializes a web ReadableStream body into the string "[object ReadableStream]"
// instead of streaming it. The route returns `new Response(stream.readable)`,
// so swap in the native (undici) Response for this suite — it supports web
// stream bodies and exposes a readable web-stream `.body`.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NativeResponse = require('undici').Response;
const PolyfilledResponse = global.Response;

beforeAll(() => {
  global.Response = NativeResponse as unknown as typeof globalThis.Response;
});
afterAll(() => {
  global.Response = PolyfilledResponse;
});

const mockCheckRateLimit = checkRateLimit as jest.Mock;
const mockProcessStream = processAIDumpStream as jest.Mock;

/**
 * Drain an SSE Response body into the array of parsed `data:` JSON objects.
 *
 * The route returns `new Response(transformStream.readable, ...)` where the
 * body is a web ReadableStream. The setup polyfills global Response with
 * node-fetch's, which re-wraps that body as a Node Readable (async-iterable),
 * so we collect chunks by async iteration and fall back to getReader() if a
 * real web stream is present.
 */
async function readSSE(
  response: Response
): Promise<Array<{ type: string; data: unknown }>> {
  const body = response.body as unknown as
    | AsyncIterable<unknown>
    | ReadableStream<Uint8Array>;
  const decoder = new TextDecoder();
  let raw = '';
  const bytes: number[] = [];

  const consume = (chunk: unknown): void => {
    if (typeof chunk === 'string') {
      raw += chunk;
    } else if (typeof chunk === 'number') {
      // Some polyfilled bodies async-iterate a buffer byte-by-byte.
      bytes.push(chunk);
    } else {
      raw += decoder.decode(chunk as Uint8Array, { stream: true });
    }
  };

  if (typeof (body as ReadableStream).getReader === 'function') {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      consume(value);
    }
  } else {
    for await (const chunk of body as AsyncIterable<unknown>) {
      consume(chunk);
    }
  }
  raw += decoder.decode();
  if (bytes.length) raw += Buffer.from(bytes).toString('utf-8');

  const events: Array<{ type: string; data: unknown }> = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      events.push(JSON.parse(trimmed.slice('data: '.length)));
    }
  }
  return events;
}

/** Build a generator that yields the provided events. */
function makeGenerator(events: Array<{ type: string; data: unknown }>) {
  return (async function* () {
    for (const e of events) yield e;
  })();
}

const validBody = {
  content: 'This is some content to process by the AI dump pipeline.',
  source: 'paste',
};

describe('AI Dump Stream API - POST /api/ai-dump/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 20,
      remaining: 19,
      retryAfter: 0,
    });
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 when rate limited', async () => {
    setAuthenticatedUser();
    mockCheckRateLimit.mockReturnValue({
      success: false,
      limit: 20,
      remaining: 0,
      retryAfter: 30,
    });

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests. Please slow down.');
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('should return 400 for invalid JSON body', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: 'not-json{',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON');
  });

  it('should return 400 when validation fails (no content/image/fileRefs)', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify({ source: 'paste' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
  });

  it('should stream events, create a note, and emit note_created + done', async () => {
    setAuthenticatedUser();

    mockProcessStream.mockReturnValue(
      makeGenerator([
        { type: 'connected', data: null },
        {
          type: 'titles',
          data: [
            { variant: 'short', text: 'Short Title', score: 0.9 },
            { variant: 'descriptive', text: 'Longer Title', score: 0.8 },
          ],
        },
        { type: 'tags', data: [{ name: 'work', confidence: 0.7 }] },
        { type: 'tldr', data: 'A short summary.' },
        { type: 'markdown_end', data: '# Markdown body' },
        { type: 'summary_end', data: 'Full summary text.' },
        { type: 'actions', data: [] },
        { type: 'provenance', data: { llm_model: 'test' } },
        { type: 'resolved_content', data: 'resolved content' },
      ])
    );

    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-abc' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    const events = await readSSE(response);
    const types = events.map((e) => e.type);

    // First event is always "connected", processing events forwarded verbatim.
    expect(types[0]).toBe('connected');
    expect(types).toContain('titles');
    expect(types).toContain('note_created');
    expect(types[types.length - 1]).toBe('done');

    // Note created with the "short" variant title and resolved content.
    expect(mockPrismaClient.note.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArg.data.title).toBe('Short Title');
    expect(createArg.data.contentText).toBe('# Markdown body');
    expect(createArg.data.rawText).toBe('resolved content');
    expect(createArg.data.userId).toBe('test-user-id');
    expect(createArg.data.embeddingStatus).toBe('PENDING');

    const noteCreated = events.find((e) => e.type === 'note_created');
    expect((noteCreated?.data as { noteId: string }).noteId).toBe('note-abc');
  });

  it('should fall back to first title when no "short" variant exists', async () => {
    setAuthenticatedUser();

    mockProcessStream.mockReturnValue(
      makeGenerator([
        {
          type: 'titles',
          data: [{ variant: 'descriptive', text: 'Only Title', score: 0.8 }],
        },
      ])
    );
    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-2' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    await readSSE(response);

    const createArg = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArg.data.title).toBe('Only Title');
  });

  it('should default the title to "Untitled" when no titles are produced', async () => {
    setAuthenticatedUser();

    mockProcessStream.mockReturnValue(makeGenerator([{ type: 'tags', data: [] }]));
    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-3' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    await readSSE(response);

    const createArg = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArg.data.title).toBe('Untitled');
    // Falls back to the original content when no markdown/resolved events fired.
    expect(createArg.data.contentText).toBe(validBody.content);
  });

  it('should emit an error event when the generator throws', async () => {
    setAuthenticatedUser();

    mockProcessStream.mockReturnValue(
      (async function* () {
        yield { type: 'connected', data: null };
        throw new Error('pipeline blew up');
      })()
    );

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const events = await readSSE(response);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data).toBe('pipeline blew up');
    // Note should NOT be created when the pipeline fails before completion.
    expect(mockPrismaClient.note.create).not.toHaveBeenCalled();
  });

  it('should emit an error event when note creation fails', async () => {
    setAuthenticatedUser();

    mockProcessStream.mockReturnValue(
      makeGenerator([
        { type: 'titles', data: [{ variant: 'short', text: 'T', score: 1 }] },
      ])
    );
    mockPrismaClient.note.create.mockRejectedValue(new Error('db down'));

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const events = await readSSE(response);

    const errorEvent = events.find((e) => e.type === 'error');
    expect(errorEvent?.data).toBe('db down');
    expect(events.some((e) => e.type === 'note_created')).toBe(false);
  });

  it('should accept imageData-only requests (content optional)', async () => {
    setAuthenticatedUser();

    mockProcessStream.mockReturnValue(
      makeGenerator([
        { type: 'titles', data: [{ variant: 'short', text: 'Img', score: 1 }] },
      ])
    );
    mockPrismaClient.note.create.mockResolvedValue({ id: 'note-img' });

    const request = new NextRequest('http://localhost:3000/api/ai-dump/stream', {
      method: 'POST',
      body: JSON.stringify({
        imageData: 'data:image/png;base64,AAAA',
        source: 'upload',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await readSSE(response);

    expect(mockProcessStream).toHaveBeenCalled();
    // content defaults to "" when only an image is supplied.
    expect(mockProcessStream.mock.calls[0][0]).toBe('');
    const createArg = mockPrismaClient.note.create.mock.calls[0][0];
    expect(createArg.data.source).toBe('upload');
  });
});
