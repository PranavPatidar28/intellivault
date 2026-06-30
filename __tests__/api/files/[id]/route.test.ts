/**
 * Tests for individual File API Routes
 * GET /api/files/[id]   - file details + note usage
 * PATCH /api/files/[id] - rename a file
 */

import { GET, PATCH } from '@/app/api/files/[id]/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';
import mockPrismaClient from '../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Helper to build the params promise the route expects
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Files [id] API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mediaAttachment is not on the shared mock — add it per-file at runtime
    mockPrismaClient.mediaAttachment = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    };
  });

  describe('GET /api/files/[id]', () => {
    it('should return 401 when unauthenticated', async () => {
      setUnauthenticatedUser();

      const request = new NextRequest('http://localhost:3000/api/files/abc');
      const response = await GET(request, makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 404 when the attachment does not exist', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/files/abc');
      const response = await GET(request, makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('File not found');
    });

    it('should return 403 when the attachment belongs to another user', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
        id: 'abc',
        userId: 'someone-else',
        url: 'https://blob/x.png',
        size: 1024,
      });

      const request = new NextRequest('http://localhost:3000/api/files/abc');
      const response = await GET(request, makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('should return the file with notes that reference its URL', async () => {
      setAuthenticatedUser();
      const url = 'https://blob/photo.png';
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
        id: 'abc',
        userId: 'test-user-id',
        url,
        size: 2048,
        filename: 'photo.png',
        note: { id: 'n0', title: 'Owner note' },
      });

      mockPrismaClient.note.findMany.mockResolvedValue([
        { id: 'n1', title: 'Uses it', contentJSON: { body: `see ${url}` } },
        { id: 'n2', title: 'No ref', contentJSON: { body: 'nothing here' } },
      ]);

      const request = new NextRequest('http://localhost:3000/api/files/abc');
      const response = await GET(request, makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.sizeFormatted).toBe('2 KB');
      expect(data.data.usedInNotes).toEqual([{ id: 'n1', title: 'Uses it' }]);
    });

    it('should return an empty usedInNotes array when no note references the URL', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
        id: 'abc',
        userId: 'test-user-id',
        url: 'https://blob/unused.png',
        size: 100,
        filename: 'unused.png',
      });
      mockPrismaClient.note.findMany.mockResolvedValue([
        { id: 'n1', title: 'x', contentJSON: { body: 'nope' } },
      ]);

      const request = new NextRequest('http://localhost:3000/api/files/abc');
      const response = await GET(request, makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.usedInNotes).toEqual([]);
    });

    it('should return 500 when prisma throws', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockRejectedValue(
        new Error('db error')
      );

      const request = new NextRequest('http://localhost:3000/api/files/abc');
      const response = await GET(request, makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get file');
    });
  });

  describe('PATCH /api/files/[id]', () => {
    const patchReq = (id: string, body: unknown) =>
      new NextRequest(`http://localhost:3000/api/files/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

    it('should return 401 when unauthenticated', async () => {
      setUnauthenticatedUser();

      const response = await PATCH(patchReq('abc', { filename: 'new.png' }), makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 when filename is missing', async () => {
      setAuthenticatedUser();

      const response = await PATCH(patchReq('abc', {}), makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Filename is required');
    });

    it('should return 400 when filename is only whitespace', async () => {
      setAuthenticatedUser();

      const response = await PATCH(patchReq('abc', { filename: '   ' }), makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Filename is required');
    });

    it('should return 400 when filename is not a string', async () => {
      setAuthenticatedUser();

      const response = await PATCH(patchReq('abc', { filename: 42 }), makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Filename is required');
    });

    it('should return 404 when the attachment does not exist', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue(null);

      const response = await PATCH(patchReq('abc', { filename: 'new.png' }), makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('File not found');
    });

    it('should return 403 when the attachment belongs to another user', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
        id: 'abc',
        userId: 'someone-else',
      });

      const response = await PATCH(patchReq('abc', { filename: 'new.png' }), makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden');
      expect(mockPrismaClient.mediaAttachment.update).not.toHaveBeenCalled();
    });

    it('should rename the file and trim the filename', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
        id: 'abc',
        userId: 'test-user-id',
      });
      mockPrismaClient.mediaAttachment.update.mockResolvedValue({
        id: 'abc',
        userId: 'test-user-id',
        filename: 'renamed.png',
        size: 4096,
      });

      const response = await PATCH(
        patchReq('abc', { filename: '  renamed.png  ' }),
        makeParams('abc')
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.filename).toBe('renamed.png');
      expect(data.data.sizeFormatted).toBe('4 KB');
      expect(mockPrismaClient.mediaAttachment.update).toHaveBeenCalledWith({
        where: { id: 'abc' },
        data: { filename: 'renamed.png' },
      });
    });

    it('should return 500 when the update throws', async () => {
      setAuthenticatedUser();
      mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
        id: 'abc',
        userId: 'test-user-id',
      });
      mockPrismaClient.mediaAttachment.update.mockRejectedValue(new Error('db error'));

      const response = await PATCH(patchReq('abc', { filename: 'new.png' }), makeParams('abc'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to rename file');
    });
  });
});
