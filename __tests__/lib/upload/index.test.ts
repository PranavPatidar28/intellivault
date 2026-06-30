import * as upload from '@/lib/upload';
import '../../mocks/prisma';

// @vercel/blob is pulled in transitively via upload-service; mock it so the
// barrel module loads without a real network/SDK.
jest.mock('@vercel/blob', () => ({ put: jest.fn(), del: jest.fn() }));

describe('lib/upload barrel (index.ts)', () => {
  it('re-exports file-type helpers', () => {
    expect(typeof upload.validateFile).toBe('function');
    expect(typeof upload.getFileCategory).toBe('function');
    expect(typeof upload.generateBlobPathname).toBe('function');
    expect(typeof upload.formatFileSize).toBe('function');
    expect(upload.FILE_TYPE_CONFIG).toBeDefined();
  });

  it('re-exports upload-service functions', () => {
    expect(typeof upload.uploadFile).toBe('function');
    expect(typeof upload.deleteFile).toBe('function');
    expect(typeof upload.getUserAttachments).toBe('function');
    expect(typeof upload.linkAttachmentToNote).toBe('function');
  });
});
