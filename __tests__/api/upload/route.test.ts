/**
 * Tests for Server-side Upload API Route
 * POST /api/upload — authenticated multipart upload to Vercel Blob.
 *
 * The actual blob write + DB record creation lives in `uploadFile`
 * (@/lib/upload/upload-service), which is mocked here. We exercise the route's
 * own branches: auth gating, "no file", file validation, success shaping, and
 * the 500 catch-all.
 */

import { NextRequest } from 'next/server';
import '../../mocks/prisma';
import '../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../mocks/auth';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock the upload service so no real Vercel Blob / Prisma call happens.
jest.mock('@/lib/upload/upload-service', () => ({
  uploadFile: jest.fn(),
}));

import { POST } from '@/app/api/upload/route';
import { uploadFile } from '@/lib/upload/upload-service';

const mockUploadFile = uploadFile as jest.Mock;

/**
 * Build a request-like object exposing the single method the route uses:
 * `formData()`. We bypass NextRequest's body parsing (node-fetch polyfill in
 * the test env does not reconstruct multipart bodies) by stubbing formData.
 */
function makeUploadRequest(form: FormData): NextRequest {
  const req = new NextRequest('http://localhost:3000/api/upload', {
    method: 'POST',
  });
  (req as any).formData = jest.fn(() => Promise.resolve(form));
  return req;
}

/** A small valid PNG file (well under the 5MB image cap). */
function validImageFile(): File {
  return new File([new Uint8Array([1, 2, 3, 4])], 'photo.png', {
    type: 'image/png',
  });
}

describe('Upload API - POST /api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const form = new FormData();
    form.append('file', validImageFile());

    const response = await POST(makeUploadRequest(form));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should return 400 when no file is provided', async () => {
    setAuthenticatedUser();

    const form = new FormData(); // no "file" entry

    const response = await POST(makeUploadRequest(form));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('No file provided');
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should return 400 when the file type is unsupported', async () => {
    setAuthenticatedUser();

    const form = new FormData();
    form.append(
      'file',
      new File([new Uint8Array([0])], 'bad.exe', {
        type: 'application/x-msdownload',
      })
    );

    const response = await POST(makeUploadRequest(form));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('is not supported');
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should return 400 when the file exceeds the category size cap', async () => {
    setAuthenticatedUser();

    // Image cap is 5MB; fake a 6MB file by overriding size.
    const big = validImageFile();
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });

    const form = new FormData();
    form.append('file', big);

    const response = await POST(makeUploadRequest(form));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('exceeds maximum allowed');
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should upload a valid file and return shaped metadata', async () => {
    setAuthenticatedUser();

    mockUploadFile.mockResolvedValue({
      id: 'att-123',
      url: 'https://blob.example.com/uploads/test-user-id/123-abc.png',
      pathname: 'uploads/test-user-id/123-abc.png',
      filename: 'photo.png',
      mimeType: 'image/png',
      fileType: 'IMAGE',
      size: 4,
    });

    const form = new FormData();
    form.append('file', validImageFile());
    form.append('noteId', 'note-9');

    const response = await POST(makeUploadRequest(form));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('att-123');
    expect(data.data.filename).toBe('photo.png');
    expect(data.data.mimeType).toBe('image/png');
    expect(data.data.category).toBe('IMAGE');
    expect(data.data.sizeFormatted).toBe('4 Bytes');

    // noteId from the form is forwarded to the service.
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(File),
      'test-user-id',
      'note-9'
    );
  });

  it('should pass undefined noteId when none is supplied', async () => {
    setAuthenticatedUser();

    mockUploadFile.mockResolvedValue({
      id: 'att-1',
      url: 'https://blob.example.com/x.png',
      pathname: 'x.png',
      filename: 'photo.png',
      mimeType: 'image/png',
      fileType: 'IMAGE',
      size: 4,
    });

    const form = new FormData();
    form.append('file', validImageFile());

    const response = await POST(makeUploadRequest(form));
    expect(response.status).toBe(200);
    expect(mockUploadFile).toHaveBeenCalledWith(
      expect.any(File),
      'test-user-id',
      undefined
    );
  });

  it('should return 500 (with message in non-prod) when the upload service throws', async () => {
    setAuthenticatedUser();
    process.env.NODE_ENV = 'development';

    mockUploadFile.mockRejectedValue(new Error('blob storage exploded'));

    const form = new FormData();
    form.append('file', validImageFile());

    const response = await POST(makeUploadRequest(form));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('blob storage exploded');
  });

  it('should hide the error message in production', async () => {
    setAuthenticatedUser();
    process.env.NODE_ENV = 'production';

    mockUploadFile.mockRejectedValue(new Error('sensitive detail'));

    const form = new FormData();
    form.append('file', validImageFile());

    const response = await POST(makeUploadRequest(form));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Upload failed');
  });
});
