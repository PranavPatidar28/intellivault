/**
 * Tests for Notes API Routes
 * Tests both GET and POST operations on /api/notes
 */

import { POST, GET } from '@/app/api/notes/route';
import { NextRequest } from 'next/server';
import '../../mocks/prisma';
import '../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../mocks/auth';
import mockPrismaClient from '../../mocks/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock embedding service
jest.mock("@/lib/ai/embedding-sync", () => ({
  embedNote: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Notes API - POST /api/notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Note' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should create a note with valid data', async () => {
    setAuthenticatedUser();

    const mockCreatedNote = {
      id: 'note-123',
      title: 'Test Note',
      contentJSON: {},
      contentText: '',
      userId: 'test-user-id',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaClient.note.create.mockResolvedValue(mockCreatedNote);

    const request = new NextRequest('http://localhost:3000/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Note',
        contentJSON: {},
        contentText: '',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.title).toBe('Test Note');
    expect(mockPrismaClient.note.create).toHaveBeenCalled();
  });

  it('should return 400 for missing title', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes', {
      method: 'POST',
      body: JSON.stringify({ contentText: 'Content without title' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 for title that is too long', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'a'.repeat(101) }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should create note with tags', async () => {
    setAuthenticatedUser();

    const mockCreatedNote = {
      id: 'note-123',
      title: 'Test Note',
      contentJSON: {},
      contentText: '',
      userId: 'test-user-id',
      tags: [
        { id: 'tag-1', name: 'tag1', slug: 'tag1' },
        { id: 'tag-2', name: 'tag2', slug: 'tag2' },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaClient.note.create.mockResolvedValue(mockCreatedNote);

    const request = new NextRequest('http://localhost:3000/api/notes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Note',
        tags: ['tag1', 'tag2'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.tags).toHaveLength(2);
  });

  it('should return 500 on database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.create.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Note' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create note');
  });
});

describe('Notes API - GET /api/notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should fetch notes with default pagination', async () => {
    setAuthenticatedUser();

    const mockNotes = [
      {
        id: '1',
        title: 'Note 1',
        contentJSON: {},
        contentText: 'Content 1',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { attachments: 0 },
      },
    ];

    mockPrismaClient.note.findMany.mockResolvedValue(mockNotes);
    mockPrismaClient.note.count.mockResolvedValue(1);

    const request = new NextRequest('http://localhost:3000/api/notes');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.metadata.page).toBe(1);
    expect(data.metadata.limit).toBe(10);
  });

  it('should handle custom pagination parameters', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.note.count.mockResolvedValue(100);

    const request = new NextRequest('http://localhost:3000/api/notes?page=2&limit=20');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metadata.page).toBe(2);
    expect(data.metadata.limit).toBe(20);
    expect(data.metadata.total).toBe(100);
    expect(data.metadata.totalPages).toBe(5);
  });

  it('should return 400 for invalid pagination parameters', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes?page=-1');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 400 for limit over 100', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes?limit=101');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 500 on database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findMany.mockRejectedValue(new Error('Database error'));
    mockPrismaClient.note.count.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/notes');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch notes');
  });

  it('should calculate total pages correctly', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findMany.mockResolvedValue([]);
    mockPrismaClient.note.count.mockResolvedValue(25);

    const request = new NextRequest('http://localhost:3000/api/notes?limit=10');

    const response = await GET(request);
    const data = await response.json();

    expect(data.metadata.totalPages).toBe(3); // Math.ceil(25/10) = 3
  });
});
