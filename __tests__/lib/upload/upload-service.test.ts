import { put, del } from '@vercel/blob';
import {
  uploadFile,
  deleteFile,
  getUserAttachments,
  linkAttachmentToNote,
} from '@/lib/upload/upload-service';
import '../../mocks/prisma';
import mockPrismaClient from '../../mocks/prisma';
import { FileType } from '@/generated/prisma/client';

jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  del: jest.fn(),
}));

const mockPut = put as jest.Mock;
const mockDel = del as jest.Mock;

const USER = 'test-user-id';

function makeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  // size is read-only on the constructed File; override it for validation.
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPrismaClient.mediaAttachment = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
});

describe('uploadFile', () => {
  it('uploads a valid image and creates a db record', async () => {
    const file = makeFile('pic.png', 'image/png', 1024);
    mockPut.mockResolvedValue({ url: 'https://blob/pic.png', pathname: 'uploads/u/pic.png' });
    mockPrismaClient.mediaAttachment.create.mockResolvedValue({
      id: 'att-1',
      url: 'https://blob/pic.png',
      pathname: 'uploads/u/pic.png',
      filename: 'pic.png',
      mimeType: 'image/png',
      fileType: FileType.IMAGE,
      size: 1024,
    });

    const result = await uploadFile(file, USER);

    expect(mockPut).toHaveBeenCalledWith(
      expect.stringContaining(`uploads/${USER}/`),
      file,
      { access: 'public', addRandomSuffix: false }
    );
    expect(mockPrismaClient.mediaAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: 'https://blob/pic.png',
          fileType: FileType.IMAGE,
          userId: USER,
          noteId: undefined,
        }),
      })
    );
    expect(result).toEqual({
      id: 'att-1',
      url: 'https://blob/pic.png',
      pathname: 'uploads/u/pic.png',
      filename: 'pic.png',
      mimeType: 'image/png',
      fileType: FileType.IMAGE,
      size: 1024,
    });
  });

  it('passes through a noteId when provided', async () => {
    const file = makeFile('a.pdf', 'application/pdf', 2048);
    mockPut.mockResolvedValue({ url: 'u', pathname: 'p' });
    mockPrismaClient.mediaAttachment.create.mockResolvedValue({
      id: 'i', url: 'u', pathname: 'p', filename: 'a.pdf', mimeType: 'application/pdf',
      fileType: FileType.DOCUMENT, size: 2048,
    });

    await uploadFile(file, USER, 'note-9');

    expect(mockPrismaClient.mediaAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ noteId: 'note-9' }) })
    );
  });

  it('maps each category to the correct FileType', async () => {
    const cases: Array<[string, string, FileType]> = [
      ['v.mp4', 'video/mp4', FileType.VIDEO],
      ['a.mp3', 'audio/mpeg', FileType.AUDIO],
      ['d.txt', 'text/plain', FileType.DOCUMENT],
    ];
    for (const [name, type, expected] of cases) {
      mockPut.mockResolvedValue({ url: 'u', pathname: 'p' });
      mockPrismaClient.mediaAttachment.create.mockResolvedValue({
        id: 'i', url: 'u', pathname: 'p', filename: name, mimeType: type, fileType: expected, size: 10,
      });
      await uploadFile(makeFile(name, type, 10), USER);
      expect(mockPrismaClient.mediaAttachment.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fileType: expected }) })
      );
    }
  });

  it('throws on an unsupported file type and never touches blob/db', async () => {
    const file = makeFile('x.svg', 'image/svg+xml', 10);
    await expect(uploadFile(file, USER)).rejects.toThrow(/not supported/);
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockPrismaClient.mediaAttachment.create).not.toHaveBeenCalled();
  });

  it('throws when the file exceeds the size limit', async () => {
    const file = makeFile('big.png', 'image/png', 6 * 1024 * 1024);
    await expect(uploadFile(file, USER)).rejects.toThrow(/exceeds maximum/);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('propagates blob upload failures', async () => {
    const file = makeFile('pic.png', 'image/png', 1024);
    mockPut.mockRejectedValue(new Error('blob down'));
    await expect(uploadFile(file, USER)).rejects.toThrow('blob down');
    expect(mockPrismaClient.mediaAttachment.create).not.toHaveBeenCalled();
  });
});

describe('deleteFile', () => {
  it('throws when the attachment is not found', async () => {
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue(null);
    await expect(deleteFile('https://blob/x', USER)).rejects.toThrow('File not found');
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('throws when the requester does not own the file', async () => {
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
      id: 'a', url: 'https://blob/x', userId: 'someone-else',
    });
    await expect(deleteFile('https://blob/x', USER)).rejects.toThrow(/permission/);
    expect(mockDel).not.toHaveBeenCalled();
  });

  it('deletes the blob and record when no notes reference the file', async () => {
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
      id: 'att-1', url: 'https://blob/x', userId: USER,
    });
    mockPrismaClient.note.findMany.mockResolvedValue([
      { id: 'n1', contentJSON: { type: 'doc', content: [] }, contentText: 'nothing' },
    ]);

    const result = await deleteFile('https://blob/x', USER);

    expect(result).toEqual({ affectedNotes: 0 });
    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
    expect(mockDel).toHaveBeenCalledWith('https://blob/x');
    expect(mockPrismaClient.mediaAttachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
  });

  it('removes media nodes from referencing notes and cleans up', async () => {
    const url = 'https://blob/img.png';
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
      id: 'att-1', url, userId: USER,
    });
    const contentJSON = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello' }] },
        { type: 'image', attrs: { src: url } },
      ],
    };
    mockPrismaClient.note.findMany.mockResolvedValue([
      { id: 'n1', contentJSON, contentText: 'hello' },
    ]);

    const result = await deleteFile(url, USER);

    expect(result).toEqual({ affectedNotes: 1 });
    expect(mockPrismaClient.note.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'n1' });
    // the image node (with matching src) must be gone
    const cleaned = updateArg.data.contentJSON as { content: Array<{ type: string }> };
    expect(cleaned.content.some((n) => n.type === 'image')).toBe(false);
    expect(updateArg.data.contentText).toBe('hello');
    expect(mockDel).toHaveBeenCalledWith(url);
    expect(mockPrismaClient.mediaAttachment.delete).toHaveBeenCalled();
  });

  it('falls back to stripping the url from contentText when cleaned text is empty', async () => {
    const url = 'https://blob/only.png';
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({
      id: 'att-2', url, userId: USER,
    });
    const contentJSON = { type: 'doc', content: [{ type: 'image', attrs: { src: url } }] };
    mockPrismaClient.note.findMany.mockResolvedValue([
      { id: 'n2', contentJSON, contentText: `before ${url} after` },
    ]);

    await deleteFile(url, USER);

    const updateArg = mockPrismaClient.note.update.mock.calls[0][0];
    expect(updateArg.data.contentText).toBe('before  after');
  });
});

describe('getUserAttachments', () => {
  it('returns mapped attachments with default paging', async () => {
    mockPrismaClient.mediaAttachment.findMany.mockResolvedValue([
      { id: 'a', url: 'u', pathname: 'p', filename: 'f', mimeType: 'm', fileType: FileType.IMAGE, size: 1, extra: 'x' },
    ]);

    const result = await getUserAttachments(USER);

    expect(mockPrismaClient.mediaAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      })
    );
    expect(result).toEqual([
      { id: 'a', url: 'u', pathname: 'p', filename: 'f', mimeType: 'm', fileType: FileType.IMAGE, size: 1 },
    ]);
  });

  it('applies noteId, fileType, limit and offset filters', async () => {
    mockPrismaClient.mediaAttachment.findMany.mockResolvedValue([]);

    await getUserAttachments(USER, {
      noteId: 'n1',
      fileType: FileType.VIDEO,
      limit: 5,
      offset: 10,
    });

    expect(mockPrismaClient.mediaAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, noteId: 'n1', fileType: FileType.VIDEO },
        take: 5,
        skip: 10,
      })
    );
  });
});

describe('linkAttachmentToNote', () => {
  it('throws when the attachment is not found', async () => {
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue(null);
    await expect(linkAttachmentToNote('att-x', 'note-1', USER)).rejects.toThrow('Attachment not found');
    expect(mockPrismaClient.mediaAttachment.update).not.toHaveBeenCalled();
  });

  it('throws when the requester does not own the attachment', async () => {
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({ id: 'att-x', userId: 'other' });
    await expect(linkAttachmentToNote('att-x', 'note-1', USER)).rejects.toThrow(/permission/);
    expect(mockPrismaClient.mediaAttachment.update).not.toHaveBeenCalled();
  });

  it('links the attachment to the note when owned', async () => {
    mockPrismaClient.mediaAttachment.findUnique.mockResolvedValue({ id: 'att-x', userId: USER });
    mockPrismaClient.mediaAttachment.update.mockResolvedValue({});

    await linkAttachmentToNote('att-x', 'note-1', USER);

    expect(mockPrismaClient.mediaAttachment.update).toHaveBeenCalledWith({
      where: { id: 'att-x' },
      data: { noteId: 'note-1' },
    });
  });
});
