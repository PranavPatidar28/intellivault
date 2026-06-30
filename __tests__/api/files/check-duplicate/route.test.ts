/**
 * Tests for the duplicate-check route
 * POST /api/files/check-duplicate
 */

import { POST } from '@/app/api/files/check-duplicate/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

const postReq = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/files/check-duplicate', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('Files check-duplicate API - POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.mediaAttachment = { findFirst: jest.fn() };
  });

  it('should return 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(postReq({ filename: 'a.png', size: 10 }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.mediaAttachment.findFirst).not.toHaveBeenCalled();
  });

  it('should return 400 when filename is missing', async () => {
    setAuthenticatedUser();

    const response = await POST(postReq({ size: 10 }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Filename and size are required');
  });

  it('should return 400 when size is missing', async () => {
    setAuthenticatedUser();

    const response = await POST(postReq({ filename: 'a.png' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Filename and size are required');
  });

  it('should report a duplicate with a formatted size when a match exists', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue({
      id: 'f1',
      url: 'https://blob/a.png',
      filename: 'a.png',
      mimeType: 'image/png',
      size: 2048,
      fileType: 'IMAGE',
      createdAt: new Date('2024-01-01'),
    });

    const response = await POST(
      postReq({ filename: 'a.png', size: 2048, mimeType: 'image/png' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isDuplicate).toBe(true);
    expect(data.existingFile.id).toBe('f1');
    expect(data.existingFile.sizeFormatted).toBe('2 KB');

    // mimeType is included in the where clause when provided
    expect(mockPrismaClient.mediaAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'test-user-id',
          filename: 'a.png',
          size: 2048,
          mimeType: 'image/png',
        }),
      })
    );
  });

  it('should report no duplicate when nothing matches', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue(null);

    const response = await POST(postReq({ filename: 'b.png', size: 99 }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.isDuplicate).toBe(false);
    expect(data.existingFile).toBeUndefined();
  });

  it('should omit mimeType from the query when not provided', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue(null);

    await POST(postReq({ filename: 'b.png', size: 99 }));

    const whereArg = mockPrismaClient.mediaAttachment.findFirst.mock.calls[0][0].where;
    expect(whereArg.mimeType).toBeUndefined();
  });

  it('should return 500 when prisma throws', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockRejectedValue(new Error('db error'));

    const response = await POST(postReq({ filename: 'a.png', size: 10 }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to check for duplicates');
  });
});
