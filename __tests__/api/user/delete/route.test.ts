/**
 * Tests for User Account Deletion API Route
 * Tests DELETE operation on /api/user/delete
 */

import { DELETE } from '@/app/api/user/delete/route';
import '../../../mocks/prisma';
import mockPrismaClient from '../../../mocks/prisma';
import { mockAuthenticatedSession } from '../../../mocks/auth';

jest.mock('@/lib/session', () => ({
  requireAuth: jest.fn(),
}));

jest.mock('@vercel/blob', () => ({
  del: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/ai/embedding-sync', () => ({
  handleNoteDeleted: jest.fn().mockResolvedValue({ success: true }),
}));

// Provide a signOut on the globally-mocked auth (jest.setup wires the object).
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

import { requireAuth } from '@/lib/session';
import { del } from '@vercel/blob';
import { handleNoteDeleted } from '@/lib/ai/embedding-sync';
import { auth } from '@/lib/auth';

const mockRequireAuth = requireAuth as jest.Mock;
const mockDel = del as jest.Mock;
const mockHandleNoteDeleted = handleNoteDeleted as jest.Mock;
const mockSignOut = (auth as any).api.signOut as jest.Mock;

const setAuthenticated = () =>
  mockRequireAuth.mockResolvedValue(mockAuthenticatedSession);
const setUnauthenticated = () =>
  mockRequireAuth.mockRejectedValue(new Error('Unauthorized'));

const buildRequest = (body: unknown) =>
  ({ json: jest.fn().mockResolvedValue(body) } as unknown as Request);

// Wire transactional models used inside $transaction. The shared mock's
// $transaction passes mockPrismaClient itself as `tx`, so add the deleteMany
// methods the route calls on tx.
const wireTxModels = () => {
  mockPrismaClient.mediaAttachment = {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  mockPrismaClient.note.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  mockPrismaClient.note.findMany = jest.fn().mockResolvedValue([]);
  mockPrismaClient.tagRelation = {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  mockPrismaClient.tag.deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  mockPrismaClient.userPreferences = {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  mockPrismaClient.session.deleteMany = jest
    .fn()
    .mockResolvedValue({ count: 0 });
  mockPrismaClient.account = {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  mockPrismaClient.user.delete = jest.fn().mockResolvedValue({});
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSignOut.mockResolvedValue(undefined);
  mockDel.mockResolvedValue(undefined);
  mockHandleNoteDeleted.mockResolvedValue({ success: true });
  wireTxModels();
});

describe('User Delete API - DELETE /api/user/delete', () => {
  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const response = await DELETE(buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when confirmation phrase is wrong', async () => {
    setAuthenticated();

    const response = await DELETE(buildRequest({ confirmPhrase: 'nope' }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('DELETE MY ACCOUNT');
    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('should return 400 when confirmation phrase is missing', async () => {
    setAuthenticated();

    const response = await DELETE(buildRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(mockPrismaClient.$transaction).not.toHaveBeenCalled();
  });

  it('should delete the account and all data on valid confirmation', async () => {
    setAuthenticated();

    const response = await DELETE(
      buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    expect(mockPrismaClient.mediaAttachment.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'test-user-id' },
    });
    expect(mockPrismaClient.note.deleteMany).toHaveBeenCalled();
    expect(mockPrismaClient.tag.deleteMany).toHaveBeenCalled();
    expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
      where: { id: 'test-user-id' },
    });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should purge Pinecone vectors note-by-note', async () => {
    setAuthenticated();
    mockPrismaClient.note.findMany.mockResolvedValue([
      { id: 'n1', chunkCount: 3 },
      { id: 'n2', chunkCount: null },
    ]);

    const response = await DELETE(
      buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' })
    );

    expect(response.status).toBe(200);
    expect(mockHandleNoteDeleted).toHaveBeenCalledTimes(2);
    expect(mockHandleNoteDeleted).toHaveBeenCalledWith('n1', 'test-user-id', 3);
    expect(mockHandleNoteDeleted).toHaveBeenCalledWith(
      'n2',
      'test-user-id',
      undefined
    );
  });

  it('should delete blob attachments when present', async () => {
    setAuthenticated();
    mockPrismaClient.mediaAttachment.findMany.mockResolvedValue([
      { url: 'https://blob/a' },
      { url: 'https://blob/b' },
    ]);

    const response = await DELETE(
      buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' })
    );

    expect(response.status).toBe(200);
    expect(mockDel).toHaveBeenCalledWith(['https://blob/a', 'https://blob/b']);
  });

  it('should not call blob del when there are no attachments', async () => {
    setAuthenticated();
    mockPrismaClient.mediaAttachment.findMany.mockResolvedValue([]);

    await DELETE(buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' }));

    expect(mockDel).not.toHaveBeenCalled();
  });

  it('should still succeed when blob deletion fails', async () => {
    setAuthenticated();
    mockPrismaClient.mediaAttachment.findMany.mockResolvedValue([
      { url: 'https://blob/a' },
    ]);
    mockDel.mockRejectedValue(new Error('blob down'));

    const response = await DELETE(
      buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should still succeed when signOut fails', async () => {
    setAuthenticated();
    mockSignOut.mockRejectedValue(new Error('signout failed'));

    const response = await DELETE(
      buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should still succeed when a vector purge rejects (allSettled)', async () => {
    setAuthenticated();
    mockPrismaClient.note.findMany.mockResolvedValue([{ id: 'n1', chunkCount: 1 }]);
    mockHandleNoteDeleted.mockRejectedValue(new Error('pinecone down'));

    const response = await DELETE(
      buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 500 when the transaction fails', async () => {
    setAuthenticated();
    mockPrismaClient.$transaction.mockRejectedValueOnce(new Error('DB error'));

    const response = await DELETE(
      buildRequest({ confirmPhrase: 'DELETE MY ACCOUNT' })
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete account');
  });
});
