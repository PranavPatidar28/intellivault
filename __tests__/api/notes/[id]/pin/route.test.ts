/**
 * Tests for Note Pin API Route
 * Tests PATCH /api/notes/[id]/pin (toggle pinned state)
 */

import { PATCH } from '@/app/api/notes/[id]/pin/route';
import { NextRequest } from 'next/server';
import '../../../../mocks/prisma';
import '../../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../../mocks/auth';
import mockPrismaClient from '../../../../mocks/prisma';

jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

const makeRequest = () =>
  new NextRequest('http://localhost:3000/api/notes/note-123/pin', {
    method: 'PATCH',
  });

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('Note Pin API - PATCH /api/notes/[id]/pin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const response = await PATCH(makeRequest(), makeParams('note-123'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockPrismaClient.note.findFirst).not.toHaveBeenCalled();
  });

  it('should return 404 when the note is not found', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue(null);

    const response = await PATCH(makeRequest(), makeParams('missing-id'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Note not found');
    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
  });

  it('should pin a currently unpinned note and set pinnedAt', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue({ id: 'note-123', isPinned: false });
    mockPrismaClient.note.update.mockResolvedValue({
      id: 'note-123',
      isPinned: true,
      pinnedAt: new Date('2024-01-01'),
    });

    const response = await PATCH(makeRequest(), makeParams('note-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.isPinned).toBe(true);

    // Toggled from false -> true: pinnedAt should be a Date, not null.
    const updateArg = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'note-123' });
    expect(updateArg.data.isPinned).toBe(true);
    expect(updateArg.data.pinnedAt).toBeInstanceOf(Date);
  });

  it('should unpin a currently pinned note and clear pinnedAt', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue({ id: 'note-123', isPinned: true });
    mockPrismaClient.note.update.mockResolvedValue({
      id: 'note-123',
      isPinned: false,
      pinnedAt: null,
    });

    const response = await PATCH(makeRequest(), makeParams('note-123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.note.isPinned).toBe(false);

    // Toggled from true -> false: pinnedAt should be null.
    const updateArg = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArg.data.isPinned).toBe(false);
    expect(updateArg.data.pinnedAt).toBeNull();
  });

  it('should scope the ownership lookup to the authenticated user', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue({ id: 'note-123', isPinned: false });
    mockPrismaClient.note.update.mockResolvedValue({
      id: 'note-123',
      isPinned: true,
      pinnedAt: new Date(),
    });

    await PATCH(makeRequest(), makeParams('note-123'));

    const findArg = mockPrismaClient.note.findFirst.mock.calls[0][0];
    expect(findArg.where).toEqual({ id: 'note-123', userId: 'test-user-id' });
  });

  it('should return 500 when the database update fails', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockResolvedValue({ id: 'note-123', isPinned: false });
    mockPrismaClient.note.update.mockRejectedValue(new Error('Database error'));

    const response = await PATCH(makeRequest(), makeParams('note-123'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update pin status');
  });

  it('should return 500 when the ownership lookup fails', async () => {
    setAuthenticatedUser();
    mockPrismaClient.note.findFirst.mockRejectedValue(new Error('Database error'));

    const response = await PATCH(makeRequest(), makeParams('note-123'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update pin status');
  });
});
