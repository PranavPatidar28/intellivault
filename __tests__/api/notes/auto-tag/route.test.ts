/**
 * Tests for Auto-Tagging API Routes
 * Tests POST (suggest/auto-apply) and PUT (apply specific tags) on /api/notes/auto-tag
 */

import { POST, PUT } from '@/app/api/notes/auto-tag/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock the auto-tagging service (external AI work).
jest.mock('@/lib/ai/auto-tagging-service', () => ({
  autoTagNote: jest.fn(),
  applyTagsToNote: jest.fn(),
}));

import { autoTagNote, applyTagsToNote } from '@/lib/ai/auto-tagging-service';

const mockAutoTagNote = autoTagNote as jest.Mock;
const mockApplyTagsToNote = applyTagsToNote as jest.Mock;

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/notes/auto-tag', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('Auto-Tag API - POST /api/notes/auto-tag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // userPreferences model is not on the shared prisma mock; add it per file.
    mockPrismaClient.userPreferences = { findUnique: jest.fn() };
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(makeRequest({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockAutoTagNote).not.toHaveBeenCalled();
  });

  it('should return 400 when noteId is missing', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(Array.isArray(data.details)).toBe(true);
  });

  it('should return 400 when maxSuggestions exceeds the allowed range', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ noteId: 'note-1', maxSuggestions: 50 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when minConfidence is out of range', async () => {
    setAuthenticatedUser();

    const response = await POST(makeRequest({ noteId: 'note-1', minConfidence: 2 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return suggestions on the happy path', async () => {
    setAuthenticatedUser();

    mockAutoTagNote.mockResolvedValue({
      suggestions: [{ name: 'work', confidence: 0.9 }],
      appliedTags: [],
      provider: 'openai',
      latencyMs: 120,
    });

    const response = await POST(makeRequest({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.suggestions).toHaveLength(1);
    expect(data.provider).toBe('openai');
    expect(data.latencyMs).toBe(120);
  });

  it('should pass validated options (with defaults) through to the service', async () => {
    setAuthenticatedUser();

    mockAutoTagNote.mockResolvedValue({
      suggestions: [],
      appliedTags: ['work'],
      provider: 'openai',
      latencyMs: 50,
    });

    await POST(
      makeRequest({ noteId: 'note-1', autoApply: true, autoApplyThreshold: 0.8 })
    );

    expect(mockAutoTagNote).toHaveBeenCalledWith('note-1', 'test-user-id', {
      maxSuggestions: 5,
      minConfidence: 0.3,
      autoApply: true,
      autoApplyThreshold: 0.8,
    });
  });

  it('should return 404 when the service reports the note is missing', async () => {
    setAuthenticatedUser();

    mockAutoTagNote.mockRejectedValue(new Error('Note not found'));

    const response = await POST(makeRequest({ noteId: 'missing' }));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('should return 500 on an unexpected service error', async () => {
    setAuthenticatedUser();

    mockAutoTagNote.mockRejectedValue(new Error('LLM exploded'));

    const response = await POST(makeRequest({ noteId: 'note-1' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate tag suggestions');
  });
});

describe('Auto-Tag API - PUT /api/notes/auto-tag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.userPreferences = { findUnique: jest.fn() };
  });

  const makePutRequest = (body: unknown) =>
    new NextRequest('http://localhost:3000/api/notes/auto-tag', {
      method: 'PUT',
      body: JSON.stringify(body),
    });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await PUT(makePutRequest({ noteId: 'note-1', tagNames: ['a'] }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when tagNames is empty', async () => {
    setAuthenticatedUser();

    const response = await PUT(makePutRequest({ noteId: 'note-1', tagNames: [] }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 when noteId is missing', async () => {
    setAuthenticatedUser();

    const response = await PUT(makePutRequest({ tagNames: ['a'] }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should apply tags using the user default color preference', async () => {
    setAuthenticatedUser();

    mockPrismaClient.userPreferences.findUnique.mockResolvedValue({ defaultTagColor: '#abcdef' });
    mockApplyTagsToNote.mockResolvedValue({ applied: ['work'], created: ['work'] });

    const response = await PUT(makePutRequest({ noteId: 'note-1', tagNames: ['work'] }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.applied).toEqual(['work']);
    expect(data.created).toEqual(['work']);
    expect(mockApplyTagsToNote).toHaveBeenCalledWith('note-1', 'test-user-id', ['work'], {
      defaultColor: '#abcdef',
    });
  });

  it('should apply tags with undefined color when no preferences exist', async () => {
    setAuthenticatedUser();

    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);
    mockApplyTagsToNote.mockResolvedValue({ applied: ['work'], created: [] });

    const response = await PUT(makePutRequest({ noteId: 'note-1', tagNames: ['work'] }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockApplyTagsToNote).toHaveBeenCalledWith('note-1', 'test-user-id', ['work'], {
      defaultColor: undefined,
    });
  });

  it('should return 500 when applying tags fails', async () => {
    setAuthenticatedUser();

    mockPrismaClient.userPreferences.findUnique.mockResolvedValue(null);
    mockApplyTagsToNote.mockRejectedValue(new Error('write failed'));

    const response = await PUT(makePutRequest({ noteId: 'note-1', tagNames: ['work'] }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to apply tags');
  });
});
