/**
 * Tests for the owner-scoped file content proxy
 * GET /api/files/[id]/content
 */

import { GET } from '@/app/api/files/[id]/content/route';
import { NextRequest } from 'next/server';
import '../../../../mocks/prisma';
import '../../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../../mocks/auth';
import mockPrismaClient from '../../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

// Build a fake upstream Response-like object
function upstream({
  status = 200,
  ok = true,
  contentType = 'image/png',
  extra = {} as Record<string, string>,
  body = 'bytes' as unknown,
} = {}) {
  const headerMap = new Map<string, string>(
    Object.entries({ 'content-type': contentType, ...extra })
  );
  return {
    ok,
    status,
    body,
    headers: { get: (k: string) => headerMap.get(k.toLowerCase()) ?? null },
  };
}

describe('Files [id]/content API - GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaClient.mediaAttachment = { findFirst: jest.fn() };
    global.fetch = jest.fn();
  });

  it('should return 401 when unauthenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/files/abc/content');
    const response = await GET(request, makeParams('abc'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return 404 when the attachment is not owned/found', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/files/abc/content');
    const response = await GET(request, makeParams('abc'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('File not found');
    // ownership scoped by both id and userId
    expect(mockPrismaClient.mediaAttachment.findFirst).toHaveBeenCalledWith({
      where: { id: 'abc', userId: 'test-user-id' },
      select: { url: true, mimeType: true, filename: true, fileType: true, size: true },
    });
  });

  it('should stream an inline image with security headers', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue({
      url: 'https://blob/photo.png',
      mimeType: 'image/png',
      filename: 'photo.png',
      fileType: 'IMAGE',
      size: 10,
    });
    (global.fetch as jest.Mock).mockResolvedValue(upstream({ contentType: 'image/png' }));

    const request = new NextRequest('http://localhost:3000/api/files/abc/content');
    const response = await GET(request, makeParams('abc'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-disposition')).toBe('inline; filename="photo.png"');
    expect(response.headers.get('cache-control')).toBe('private, max-age=0, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    // fetched with no range header
    expect(global.fetch).toHaveBeenCalledWith('https://blob/photo.png', { headers: undefined });
  });

  it('should force download (attachment) for DOCUMENT files and sanitize the filename', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue({
      url: 'https://blob/doc.pdf',
      mimeType: 'application/pdf',
      filename: 'evil"\r\nname.pdf',
      fileType: 'DOCUMENT',
      size: 10,
    });
    (global.fetch as jest.Mock).mockResolvedValue(
      upstream({ contentType: 'application/pdf' })
    );

    const request = new NextRequest('http://localhost:3000/api/files/abc/content');
    const response = await GET(request, makeParams('abc'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="evil___name.pdf"'
    );
  });

  it('should forward the Range header and preserve range/length response headers (206)', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue({
      url: 'https://blob/video.mp4',
      mimeType: 'video/mp4',
      filename: 'video.mp4',
      fileType: 'VIDEO',
      size: 1000,
    });
    (global.fetch as jest.Mock).mockResolvedValue(
      upstream({
        status: 206,
        ok: false, // 206 is allowed even though ok is false
        contentType: 'video/mp4',
        extra: {
          'content-length': '500',
          'content-range': 'bytes 0-499/1000',
          'accept-ranges': 'bytes',
        },
      })
    );

    const request = new NextRequest('http://localhost:3000/api/files/abc/content', {
      headers: { range: 'bytes=0-499' },
    });
    const response = await GET(request, makeParams('abc'));

    expect(response.status).toBe(206);
    expect(global.fetch).toHaveBeenCalledWith('https://blob/video.mp4', {
      headers: { range: 'bytes=0-499' },
    });
    expect(response.headers.get('content-length')).toBe('500');
    expect(response.headers.get('content-range')).toBe('bytes 0-499/1000');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
  });

  it('should fall back to the stored mimeType when upstream has no content-type', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue({
      url: 'https://blob/a.bin',
      mimeType: 'audio/mpeg',
      filename: 'a.bin',
      fileType: 'AUDIO',
      size: 10,
    });
    (global.fetch as jest.Mock).mockResolvedValue(
      upstream({ contentType: '' })
    );

    const request = new NextRequest('http://localhost:3000/api/files/abc/content');
    const response = await GET(request, makeParams('abc'));

    expect(response.headers.get('content-type')).toBe('audio/mpeg');
  });

  it('should return 502 when the upstream fetch is not ok and not 206', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue({
      url: 'https://blob/gone.png',
      mimeType: 'image/png',
      filename: 'gone.png',
      fileType: 'IMAGE',
      size: 10,
    });
    (global.fetch as jest.Mock).mockResolvedValue(
      upstream({ status: 404, ok: false })
    );

    const request = new NextRequest('http://localhost:3000/api/files/abc/content');
    const response = await GET(request, makeParams('abc'));
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toBe('Failed to load file');
  });

  it('should return 500 when the upstream fetch throws', async () => {
    setAuthenticatedUser();
    mockPrismaClient.mediaAttachment.findFirst.mockResolvedValue({
      url: 'https://blob/x.png',
      mimeType: 'image/png',
      filename: 'x.png',
      fileType: 'IMAGE',
      size: 10,
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const request = new NextRequest('http://localhost:3000/api/files/abc/content');
    const response = await GET(request, makeParams('abc'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to load file');
  });
});
