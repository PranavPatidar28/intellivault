/**
 * Tests for Individual Note API Routes
 * Tests GET, PUT, and DELETE operations on /api/notes/[id]
 */

import { GET, PUT, DELETE } from '@/app/api/notes/[id]/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock embedding service
jest.mock("@/lib/ai/embedding-sync", () => ({
  embedNote: jest.fn().mockResolvedValue({ success: true }),
  handleNoteDeleted: jest.fn().mockResolvedValue(undefined),
}));

describe('Individual Note API - GET /api/notes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes/123');
    const params = Promise.resolve({ id: '123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should fetch a note successfully', async () => {
    setAuthenticatedUser();

    const mockNote = {
      id: '123',
      title: 'Test Note',
      contentJSON: { type: 'doc' },
      contentText: 'Content',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    };

    mockPrismaClient.note.findFirst.mockResolvedValue(mockNote);

    const request = new NextRequest('http://localhost:3000/api/notes/123');
    const params = Promise.resolve({ id: '123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.id).toBe('123');
    expect(data.note.title).toBe('Test Note');
  });

  it('should return 404 for non-existent note', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/notes/nonexistent');
    const params = Promise.resolve({ id: 'nonexistent' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('should only return notes belonging to the user', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes/123');
    const params = Promise.resolve({ id: '123' });

    await GET(request, { params });

    expect(mockPrismaClient.note.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'test-user-id',
        }),
      })
    );
  });

  it('should return 500 on database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findFirst.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/notes/123');
    const params = Promise.resolve({ id: '123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch note');
  });
});

describe('Individual Note API - PUT /api/notes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    const params = Promise.resolve({ id: '123' });

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should update a note successfully', async () => {
    setAuthenticatedUser();

    const mockExistingNote = {
      id: '123',
      title: 'Old Title',
      contentJSON: {},
      contentText: '',
      userId: 'test-user-id',
    };

    const mockUpdatedNote = {
      ...mockExistingNote,
      title: 'Updated Title',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrismaClient.note.findFirst.mockResolvedValue(mockExistingNote);
    mockPrismaClient.note.update.mockResolvedValue(mockUpdatedNote);

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    const params = Promise.resolve({ id: '123' });

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.title).toBe('Updated Title');
  });

  it('should return 404 for non-existent note', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/notes/nonexistent', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Updated Title' }),
    });
    const params = Promise.resolve({ id: 'nonexistent' });

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('should return 400 for invalid data', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'PUT',
      body: JSON.stringify({ title: '' }), // Empty title is invalid
    });
    const params = Promise.resolve({ id: '123' });

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should update note with tags', async () => {
    setAuthenticatedUser();

    const mockExistingNote = {
      id: '123',
      title: 'Test Note',
      userId: 'test-user-id',
    };

    const mockTag = {
      id: 'tag-1',
      name: 'test-tag',
      slug: 'test-tag',
    };

    mockPrismaClient.note.findFirst.mockResolvedValue(mockExistingNote);
    mockPrismaClient.tag.upsert.mockResolvedValue(mockTag);
    mockPrismaClient.note.update.mockResolvedValue({
      ...mockExistingNote,
      tags: [mockTag],
      contentJSON: {},
      contentText: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'PUT',
      body: JSON.stringify({ tags: ['test-tag'] }),
    });
    const params = Promise.resolve({ id: '123' });

    const response = await PUT(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrismaClient.tag.upsert).toHaveBeenCalled();
  });
});

describe('Individual Note API - DELETE /api/notes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '123' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should delete a note successfully', async () => {
    setAuthenticatedUser();

    const mockExistingNote = {
      id: '123',
      title: 'Test Note',
      userId: 'test-user-id',
    };

    mockPrismaClient.note.findFirst.mockResolvedValue(mockExistingNote);
    mockPrismaClient.note.delete.mockResolvedValue(mockExistingNote);

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '123' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrismaClient.note.delete).toHaveBeenCalledWith({
      where: { id: '123' },
    });
  });

  it('should return 404 for non-existent note', async () => {
    setAuthenticatedUser();

    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/notes/nonexistent', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'nonexistent' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
  });

  it('should only delete notes belonging to the user', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '123' });

    await DELETE(request, { params });

    expect(mockPrismaClient.note.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'test-user-id',
        }),
      })
    );
  });

  it('should return 500 on database error', async () => {
    setAuthenticatedUser();

    const mockExistingNote = {
      id: '123',
      title: 'Test Note',
      userId: 'test-user-id',
    };

    mockPrismaClient.note.findFirst.mockResolvedValue(mockExistingNote);
    mockPrismaClient.note.delete.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/notes/123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '123' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete note');
  });
});
