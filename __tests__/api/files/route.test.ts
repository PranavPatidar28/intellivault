/**
 * Tests for Files API Routes
 * Tests GET (list) and DELETE operations on /api/files
 */

import { GET, DELETE } from '@/app/api/files/route';
import { NextRequest } from 'next/server';
import '../../mocks/prisma';
import '../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../mocks/auth';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock the upload service (deleteFile + getUserAttachments)
jest.mock('@/lib/upload/upload-service', () => ({
  getUserAttachments: jest.fn(),
  deleteFile: jest.fn(),
}));

import { getUserAttachments, deleteFile } from '@/lib/upload/upload-service';

const mockGetUserAttachments = getUserAttachments as jest.Mock;
const mockDeleteFile = deleteFile as jest.Mock;

describe('Files API - GET /api/files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/files');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Unauthorized');
    expect(mockGetUserAttachments).not.toHaveBeenCalled();
  });

  it('should list files with default pagination and format sizes', async () => {
    setAuthenticatedUser();

    mockGetUserAttachments.mockResolvedValue([
      { id: 'f1', filename: 'a.png', size: 1024, fileType: 'IMAGE' },
      { id: 'f2', filename: 'b.pdf', size: 0, fileType: 'DOCUMENT' },
    ]);

    const request = new NextRequest('http://localhost:3000/api/files');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(data.data[0].sizeFormatted).toBe('1 KB');
    expect(data.data[1].sizeFormatted).toBe('0 Bytes');

    // default options: limit 50 (capped at 100), offset 0, no noteId/fileType
    expect(mockGetUserAttachments).toHaveBeenCalledWith('test-user-id', {
      noteId: undefined,
      fileType: undefined,
      limit: 50,
      offset: 0,
    });
  });

  it('should pass noteId and a valid fileType through to the service', async () => {
    setAuthenticatedUser();
    mockGetUserAttachments.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/files?noteId=note-1&fileType=IMAGE&limit=10&offset=5'
    );

    const response = await GET(request);
    await response.json();

    expect(mockGetUserAttachments).toHaveBeenCalledWith('test-user-id', {
      noteId: 'note-1',
      fileType: 'IMAGE',
      limit: 10,
      offset: 5,
    });
  });

  it('should ignore an invalid fileType value (treated as undefined)', async () => {
    setAuthenticatedUser();
    mockGetUserAttachments.mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/files?fileType=NOT_A_REAL_TYPE'
    );

    await GET(request);

    const callArgs = mockGetUserAttachments.mock.calls[0][1];
    expect(callArgs.fileType).toBeUndefined();
  });

  it('should cap the limit at 100', async () => {
    setAuthenticatedUser();
    mockGetUserAttachments.mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/files?limit=500');

    await GET(request);

    const callArgs = mockGetUserAttachments.mock.calls[0][1];
    expect(callArgs.limit).toBe(100);
  });

  it('should return 500 when the service throws', async () => {
    setAuthenticatedUser();
    mockGetUserAttachments.mockRejectedValue(new Error('db down'));

    const request = new NextRequest('http://localhost:3000/api/files');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to list files');
  });
});

describe('Files API - DELETE /api/files', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ url: 'https://blob/x.png' }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it('should return 400 when url is missing', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/files', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File URL is required');
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it('should return 400 when url is not a string', async () => {
    setAuthenticatedUser();

    const request = new NextRequest('http://localhost:3000/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ url: 123 }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File URL is required');
  });

  it('should delete the file and return success', async () => {
    setAuthenticatedUser();
    mockDeleteFile.mockResolvedValue({ affectedNotes: 2 });

    const request = new NextRequest('http://localhost:3000/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ url: 'https://blob/x.png' }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDeleteFile).toHaveBeenCalledWith('https://blob/x.png', 'test-user-id');
  });

  it('should return 500 with the real error message in non-production (test env)', async () => {
    // NODE_ENV is "test" here (SWC inlines it at compile time, so it cannot be
    // toggled at runtime). The route treats any non-production env as non-prod
    // and surfaces the real Error.message.
    setAuthenticatedUser();
    mockDeleteFile.mockRejectedValue(new Error('blob delete failed'));

    const request = new NextRequest('http://localhost:3000/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ url: 'https://blob/x.png' }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('blob delete failed');
  });

  it('should return 500 with a generic message when the rejection is not an Error', async () => {
    // When error is not an Error instance, the route falls back to the generic
    // message regardless of environment.
    setAuthenticatedUser();
    mockDeleteFile.mockRejectedValue('some non-error rejection');

    const request = new NextRequest('http://localhost:3000/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ url: 'https://blob/x.png' }),
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete file');
  });
});
