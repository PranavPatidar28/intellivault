/**
 * Tests for Client-token Upload API Route
 * POST /api/upload/client-token — issues a Vercel Blob client upload token and
 * persists a MediaAttachment record once the browser finishes uploading.
 *
 * The route delegates to `handleUpload` from `@vercel/blob/client`. We mock it
 * so we can (a) verify the route's own auth/rate-limit/500 branches and
 * (b) drive the `onBeforeGenerateToken` / `onUploadCompleted` callbacks the
 * route supplies, which contain the real validation + persistence logic.
 */

import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

jest.mock('@vercel/blob/client', () => ({
  handleUpload: jest.fn(),
}));

jest.mock('@vercel/blob', () => ({
  head: jest.fn(),
}));

import { POST } from '@/app/api/upload/client-token/route';
import { handleUpload } from '@vercel/blob/client';
import { head } from '@vercel/blob';

const mockHandleUpload = handleUpload as jest.Mock;
const mockHead = head as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/upload/client-token', {
    method: 'POST',
  });
  (req as any).json = jest.fn(() => Promise.resolve(body));
  return req;
}

describe('Client-token Upload API - POST /api/upload/client-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    // The route writes attachment records on upload completion.
    mockPrismaClient.mediaAttachment = {
      create: jest.fn(),
    };
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await POST(makeRequest({ type: 'blob.generate-client-token' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
    expect(mockHandleUpload).not.toHaveBeenCalled();
  });

  it('should return the handleUpload JSON response on success', async () => {
    setAuthenticatedUser();
    mockHandleUpload.mockResolvedValue({ type: 'blob.generate-client-token', clientToken: 'tok_123' });

    const response = await POST(makeRequest({ type: 'blob.generate-client-token' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.clientToken).toBe('tok_123');
    expect(mockHandleUpload).toHaveBeenCalledTimes(1);
  });

  it('should return 500 (message in non-prod) when handleUpload throws', async () => {
    setAuthenticatedUser();
    process.env.NODE_ENV = 'development';
    mockHandleUpload.mockRejectedValue(new Error('token signing failed'));

    const response = await POST(makeRequest({ type: 'blob.generate-client-token' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('token signing failed');
  });

  it('should hide the error message in production', async () => {
    setAuthenticatedUser();
    process.env.NODE_ENV = 'production';
    mockHandleUpload.mockRejectedValue(new Error('sensitive'));

    const response = await POST(makeRequest({ type: 'blob.generate-client-token' }));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Upload failed');
  });

  describe('onBeforeGenerateToken callback', () => {
    // Helper: run the route, capture the options object passed to handleUpload,
    // then invoke its onBeforeGenerateToken with our own arguments.
    async function runBeforeToken(
      pathname: string,
      clientPayload: string | null
    ) {
      let captured: any;
      mockHandleUpload.mockImplementation(async (opts: any) => {
        captured = opts;
        return { ok: true };
      });
      await POST(makeRequest({ type: 'blob.generate-client-token' }));
      return captured.onBeforeGenerateToken(pathname, clientPayload);
    }

    beforeEach(() => setAuthenticatedUser());

    it('rejects when mimeType is missing', async () => {
      await expect(
        runBeforeToken('photo.png', JSON.stringify({ filename: 'photo.png' }))
      ).rejects.toThrow('Unsupported or missing file type');
    });

    it('rejects when mimeType is unsupported', async () => {
      await expect(
        runBeforeToken(
          'bad.exe',
          JSON.stringify({ filename: 'bad.exe', mimeType: 'application/x-msdownload' })
        )
      ).rejects.toThrow('Unsupported or missing file type');
    });

    it('rejects when clientPayload is absent (no mimeType available)', async () => {
      await expect(runBeforeToken('photo.png', null)).rejects.toThrow(
        'Unsupported or missing file type'
      );
    });

    it('returns allowed content types, size cap, and token payload for a valid image', async () => {
      const result = await runBeforeToken(
        'photo.png',
        JSON.stringify({
          filename: 'photo.png',
          mimeType: 'image/png',
          noteId: 'note-7',
        })
      );

      expect(result.allowedContentTypes).toContain('image/png');
      expect(result.maximumSizeInBytes).toBe(5 * 1024 * 1024); // IMAGE cap

      const token = JSON.parse(result.tokenPayload);
      expect(token.userId).toBe('test-user-id');
      expect(token.noteId).toBe('note-7');
      expect(token.mimeType).toBe('image/png');
      expect(token.pathname).toMatch(/^uploads\/test-user-id\//);
    });

    it('uses the document size cap for a PDF', async () => {
      const result = await runBeforeToken(
        'doc.pdf',
        JSON.stringify({ filename: 'doc.pdf', mimeType: 'application/pdf' })
      );
      expect(result.maximumSizeInBytes).toBe(10 * 1024 * 1024); // DOCUMENT cap
    });
  });

  describe('onUploadCompleted callback', () => {
    async function runUploadCompleted(blob: any, tokenPayload: string | null) {
      let captured: any;
      mockHandleUpload.mockImplementation(async (opts: any) => {
        captured = opts;
        return { ok: true };
      });
      await POST(makeRequest({ type: 'blob.upload-completed' }));
      return captured.onUploadCompleted({ blob, tokenPayload });
    }

    beforeEach(() => setAuthenticatedUser());

    it('creates a MediaAttachment record using size from blob head metadata', async () => {
      mockHead.mockResolvedValue({ size: 2048 });
      (mockPrismaClient.mediaAttachment.create as jest.Mock).mockResolvedValue({ id: 'a1' });

      await runUploadCompleted(
        { url: 'https://blob/x.png', pathname: 'uploads/test-user-id/x.png' },
        JSON.stringify({
          userId: 'test-user-id',
          noteId: 'note-7',
          filename: 'x.png',
          mimeType: 'image/png',
        })
      );

      expect(mockHead).toHaveBeenCalledWith('https://blob/x.png');
      expect(mockPrismaClient.mediaAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            url: 'https://blob/x.png',
            mimeType: 'image/png',
            fileType: 'IMAGE',
            size: 2048,
            userId: 'test-user-id',
            noteId: 'note-7',
          }),
        })
      );
    });

    it('falls back to size 0 when head() fails but still creates the record', async () => {
      mockHead.mockRejectedValue(new Error('head failed'));
      (mockPrismaClient.mediaAttachment.create as jest.Mock).mockResolvedValue({ id: 'a1' });

      await runUploadCompleted(
        { url: 'https://blob/y.png', pathname: 'uploads/test-user-id/y.png' },
        JSON.stringify({ userId: 'test-user-id', filename: 'y.png', mimeType: 'image/png' })
      );

      expect(mockPrismaClient.mediaAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ size: 0, noteId: null }) })
      );
    });

    it('derives filename from pathname when not provided in payload', async () => {
      mockHead.mockResolvedValue({ size: 10 });
      (mockPrismaClient.mediaAttachment.create as jest.Mock).mockResolvedValue({ id: 'a1' });

      await runUploadCompleted(
        { url: 'https://blob/z.png', pathname: 'uploads/test-user-id/derived.png' },
        JSON.stringify({ userId: 'test-user-id', mimeType: 'image/png' })
      );

      expect(mockPrismaClient.mediaAttachment.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ filename: 'derived.png' }) })
      );
    });

    it('returns early without creating a record when payload lacks userId/mimeType', async () => {
      await runUploadCompleted(
        { url: 'https://blob/q.png', pathname: 'q.png' },
        JSON.stringify({ filename: 'q.png' }) // no userId, no mimeType
      );

      expect(mockPrismaClient.mediaAttachment.create).not.toHaveBeenCalled();
      expect(mockHead).not.toHaveBeenCalled();
    });

    it('returns early when tokenPayload is null', async () => {
      await runUploadCompleted({ url: 'https://blob/n.png', pathname: 'n.png' }, null);
      expect(mockPrismaClient.mediaAttachment.create).not.toHaveBeenCalled();
    });

    it('throws "Failed to complete upload" when the DB write fails', async () => {
      mockHead.mockResolvedValue({ size: 5 });
      (mockPrismaClient.mediaAttachment.create as jest.Mock).mockRejectedValue(
        new Error('db down')
      );

      await expect(
        runUploadCompleted(
          { url: 'https://blob/e.png', pathname: 'uploads/test-user-id/e.png' },
          JSON.stringify({ userId: 'test-user-id', filename: 'e.png', mimeType: 'image/png' })
        )
      ).rejects.toThrow('Failed to complete upload');
    });
  });
});
