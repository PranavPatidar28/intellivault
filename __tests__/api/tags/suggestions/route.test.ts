/**
 * Tests for Tag Suggestions API Route
 * POST /api/tags/suggestions — suggests tags via Ollama, with keyword fallback.
 */

import { POST } from '@/app/api/tags/suggestions/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

jest.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: jest.fn(() => null),
  RATE_LIMITS: { ai: {}, upload: {}, bulk: {} },
}));

import { enforceRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/tags/suggestions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function mockOllamaResponse(text: string, ok = true) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue({ response: text }),
  });
}

describe('Tag Suggestions API - POST /api/tags/suggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (enforceRateLimit as jest.Mock).mockReturnValue(null);
    global.fetch = jest.fn();
    mockPrismaClient.tag.findMany.mockResolvedValue([]);
  });

  it('returns 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(makeRequest({ content: 'hello world' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 429 when rate limited', async () => {
    setAuthenticatedUser();
    (enforceRateLimit as jest.Mock).mockReturnValue(
      NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    );

    const response = await POST(makeRequest({ content: 'hello world' }));

    expect(response.status).toBe(429);
    expect(mockPrismaClient.tag.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 when content is missing', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 when content is empty', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ content: '' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('returns 400 when maxSuggestions exceeds 10', async () => {
    setAuthenticatedUser();

    const response = await POST(
      makeRequest({ content: 'hello', maxSuggestions: 11 })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('uses Ollama suggestions when the AI returns valid JSON', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { name: 'JavaScript', usageCount: 10 },
    ]);
    mockOllamaResponse(
      'Here you go: [{"name":"JavaScript","confidence":0.95,"reason":"matches code"},{"name":"Tutorial","confidence":0.8,"reason":"educational"}]'
    );

    const response = await POST(
      makeRequest({ content: 'A javascript tutorial about closures' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.suggestions).toHaveLength(2);
    expect(data.suggestions[0].name).toBe('JavaScript');
    expect(data.suggestions[0].existingTag).toBe(true);
    expect(data.suggestions[1].existingTag).toBe(false);
  });

  it('honors maxSuggestions when slicing AI results', async () => {
    setAuthenticatedUser();
    const ai = JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({
        name: `tag${i}`,
        confidence: 0.5,
        reason: 'x',
      }))
    );
    mockOllamaResponse(`result ${ai}`);

    const response = await POST(
      makeRequest({ content: 'some content', maxSuggestions: 3 })
    );
    const data = await response.json();

    expect(data.suggestions).toHaveLength(3);
  });

  it('falls back to keyword matching when Ollama is unavailable', async () => {
    setAuthenticatedUser();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { name: 'database', usageCount: 5 },
      { name: 'unrelated', usageCount: 1 },
    ]);

    const response = await POST(
      makeRequest({
        content: 'database database database tuning notes about database',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    const names = data.suggestions.map((s: any) => s.name);
    expect(names).toContain('database');
    expect(data.suggestions.find((s: any) => s.name === 'database').existingTag).toBe(
      true
    );
  });

  it('falls back to keyword matching when AI response has no JSON array', async () => {
    setAuthenticatedUser();
    mockOllamaResponse('Sorry, I could not produce suggestions.');
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { name: 'meeting', usageCount: 3 },
    ]);

    const response = await POST(
      makeRequest({ content: 'meeting meeting agenda for the meeting today' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestions.some((s: any) => s.name === 'meeting')).toBe(true);
  });

  it('returns relatedTags excluding already-suggested tags', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { name: 'project', usageCount: 20 },
      { name: 'ideas', usageCount: 15 },
    ]);
    // AI suggests "project" only; "ideas" should surface as related.
    mockOllamaResponse(
      '[{"name":"project","confidence":0.9,"reason":"matches"}]'
    );

    const response = await POST(makeRequest({ content: 'project planning' }));
    const data = await response.json();

    const related = data.relatedTags.map((t: any) => t.name);
    expect(related).toContain('ideas');
    expect(related).not.toContain('project');
  });

  it('returns empty suggestions when nothing matches in fallback', async () => {
    setAuthenticatedUser();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: jest.fn() });
    mockPrismaClient.tag.findMany.mockResolvedValue([
      { name: 'zzz', usageCount: 1 },
    ]);

    const response = await POST(
      makeRequest({ content: 'completely different words here' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.suggestions).toHaveLength(0);
  });

  it('scopes the tag query to the authenticated user', async () => {
    setAuthenticatedUser();
    mockOllamaResponse('[]');

    await POST(makeRequest({ content: 'anything here' }));

    const where = mockPrismaClient.tag.findMany.mock.calls[0][0].where;
    expect(where.userId).toBe('test-user-id');
    expect(where.deletedAt).toBeNull();
    expect(where.isArchived).toBe(false);
  });

  it('returns 500 when the tag query rejects', async () => {
    setAuthenticatedUser();
    mockPrismaClient.tag.findMany.mockRejectedValue(new Error('db down'));

    const response = await POST(makeRequest({ content: 'hello world' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate suggestions');
  });
});
