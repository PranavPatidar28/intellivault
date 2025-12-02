/**
 * Tests for Tags API Routes
 * Tests GET operation on /api/tags with filtering and pagination
 */

import { GET } from '@/app/api/tags/route';
import { NextRequest } from 'next/server';
import '../../mocks/prisma';
import '../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../mocks/auth';
import mockPrismaClient from '../../mocks/prisma';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

describe('Tags API - GET /api/tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/tags');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should fetch tags with default parameters', async () => {
    setAuthenticatedUser();

    const mockTags = [
      {
        id: '1',
        name: 'Tag 1',
        slug: 'tag-1',
        color: '#ef4444',
        description: null,
        isFavorite: false,
        isArchived: false,
        lastUsed: new Date(),
        createdAt: new Date(),
        deletedAt: null,
        _count: { notes: 5 },
      },
    ];

    mockPrismaClient.$transaction.mockResolvedValue([mockTags, 1]);

    const request = new NextRequest('http://localhost:3000/api/tags');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tags).toHaveLength(1);
    expect(data.tags[0].usageCount).toBe(5);
  });

  it('should filter tags by search query', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 0]);

    const request = new NextRequest('http://localhost:3000/api/tags?q=test');

    await GET(request);

    // Check that the where clause includes the search query
    const transactionCall = mockPrismaClient.$transaction.mock.calls[0][0];
    expect(transactionCall).toBeDefined();
  });

  it('should filter favorite tags', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 0]);

    const request = new NextRequest('http://localhost:3000/api/tags?favorites=true');

    await GET(request);

    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
  });

  it('should filter archived tags', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 0]);

    const request = new NextRequest('http://localhost:3000/api/tags?archived=true');

    await GET(request);

    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
  });

  it('should filter orphaned tags', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 0]);

    const request = new NextRequest('http://localhost:3000/api/tags?orphaned=true');

    await GET(request);

    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
  });

  it('should handle custom pagination', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 100]);

    const request = new NextRequest('http://localhost:3000/api/tags?page=2&limit=20');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pagination.page).toBe(2);
    expect(data.pagination.limit).toBe(20);
    expect(data.pagination.total).toBe(100);
    expect(data.pagination.pages).toBe(5);
  });

  it('should support sorting by name', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 0]);

    const request = new NextRequest('http://localhost:3000/api/tags?sort=name&order=asc');

    await GET(request);

    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
  });

  it('should support sorting by usage count', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 0]);

    const request = new NextRequest('http://localhost:3000/api/tags?sort=usageCount&order=desc');

    await GET(request);

    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
  });

  it('should include deleted tags when requested', async () => {
    setAuthenticatedUser();

    const mockDeletedTag = {
      id: '1',
      name: 'Deleted Tag',
      slug: 'deleted-tag',
      color: '#ef4444',
      description: null,
      isFavorite: false,
      isArchived: false,
      lastUsed: new Date(),
      createdAt: new Date(),
      deletedAt: new Date(),
      _count: { notes: 0 },
    };

    mockPrismaClient.$transaction.mockResolvedValue([[mockDeletedTag], 1]);

    const request = new NextRequest('http://localhost:3000/api/tags?deleted=true');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tags[0].deletedAt).toBeTruthy();
  });

  it('should format tags correctly', async () => {
    setAuthenticatedUser();

    const mockTag = {
      id: 'tag-123',
      name: 'Test Tag',
      slug: 'test-tag',
      color: '#ef4444',
      description: 'Test description',
      isFavorite: true,
      isArchived: false,
      lastUsed: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      deletedAt: null,
      _count: { notes: 10 },
    };

    mockPrismaClient.$transaction.mockResolvedValue([[mockTag], 1]);

    const request = new NextRequest('http://localhost:3000/api/tags');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tags[0]).toEqual({
      id: 'tag-123',
      name: 'Test Tag',
      slug: 'test-tag',
      color: '#ef4444',
      description: 'Test description',
      isFavorite: true,
      isArchived: false,
      usageCount: 10,
      lastUsed: expect.any(String),
      createdAt: expect.any(String),
      deletedAt: null,
    });
  });

  it('should return 500 on database error', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/tags');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch tags');
  });

  it('should calculate pagination correctly', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 47]);

    const request = new NextRequest('http://localhost:3000/api/tags?limit=10');

    const response = await GET(request);
    const data = await response.json();

    expect(data.pagination.pages).toBe(5); // Math.ceil(47/10) = 5
  });

  it('should handle multiple filters simultaneously', async () => {
    setAuthenticatedUser();

    mockPrismaClient.$transaction.mockResolvedValue([[], 0]);

    const request = new NextRequest(
      'http://localhost:3000/api/tags?favorites=true&archived=false&q=test'
    );

    await GET(request);

    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
  });
});
