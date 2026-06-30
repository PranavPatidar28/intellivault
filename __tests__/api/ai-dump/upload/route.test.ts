/**
 * @jest-environment node
 *
 * Tests for AI Dump Upload API Route
 * Tests POST /api/ai-dump/upload — file ingestion + extraction
 *
 * Runs under the Node test environment because the route relies on web
 * platform APIs (FormData/File parsing, request.formData) that jsdom does not
 * fully implement.
 */

import { POST } from '@/app/api/ai-dump/upload/route';
import { NextRequest } from 'next/server';
import '../../../mocks/prisma';
import '../../../mocks/auth';
import { setAuthenticatedUser, setUnauthenticatedUser } from '../../../mocks/auth';

// Mock next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn(() => Promise.resolve(new Headers())),
}));

// Mock the PDF extractor (unpdf) and DOCX extractor (mammoth) so no real
// parsing/network happens.
jest.mock('unpdf', () => ({
  extractText: jest.fn(),
}));

jest.mock('mammoth', () => ({
  __esModule: true,
  extractRawText: jest.fn(),
}));

import { extractText } from 'unpdf';
import * as mammoth from 'mammoth';

const mockExtractText = extractText as jest.Mock;
const mockExtractRawText = (mammoth as unknown as { extractRawText: jest.Mock })
  .extractRawText;

/**
 * Build a request object exposing formData() carrying a single File under
 * "file". We construct a minimal request rather than a real NextRequest: the
 * setup polyfills the global Request with node-fetch's, whose multipart
 * formData() parsing is unavailable, while the route only ever calls
 * request.formData(). FormData/File here are the native (undici) globals in the
 * node test environment.
 */
function buildFileRequest(file: File | null): NextRequest {
  const formData = new FormData();
  if (file) formData.set('file', file);

  return {
    formData: async () => formData,
  } as unknown as NextRequest;
}

function makeFile(content: BlobPart, name: string, type: string): File {
  return new File([content], name, { type });
}

describe('AI Dump Upload API - POST /api/ai-dump/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when user is not authenticated', async () => {
    setUnauthenticatedUser();

    const request = buildFileRequest(
      makeFile('hello', 'note.txt', 'text/plain')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when no file is provided', async () => {
    setAuthenticatedUser();

    const request = buildFileRequest(null);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No file provided');
  });

  it('should return 400 for unsupported file types', async () => {
    setAuthenticatedUser();

    const request = buildFileRequest(
      makeFile('binary', 'archive.zip', 'application/zip')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Unsupported file type');
    expect(Array.isArray(data.supported)).toBe(true);
    expect(data.supported).toContain('text/plain');
  });

  it('should return 400 when the file exceeds the 10MB limit', async () => {
    setAuthenticatedUser();

    // Construct a File whose reported size is over 10MB without actually
    // allocating that much: stub the size getter.
    const file = makeFile('x', 'big.txt', 'text/plain');
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });

    const request = buildFileRequest(file);

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('File too large. Maximum size is 10MB.');
  });

  it('should process a plain text file', async () => {
    setAuthenticatedUser();

    const request = buildFileRequest(
      makeFile('plain text body', 'note.txt', 'text/plain')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.type).toBe('text');
    expect(data.text).toBe('plain text body');
    expect(data.metadata.filename).toBe('note.txt');
    expect(data.metadata.mimeType).toBe('text/plain');
  });

  it('should process a markdown file and tag it as markdown', async () => {
    setAuthenticatedUser();

    const request = buildFileRequest(
      makeFile('# Heading', 'note.md', 'text/markdown')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe('markdown');
    expect(data.text).toBe('# Heading');
  });

  it('should process a PDF file via unpdf (array of pages)', async () => {
    setAuthenticatedUser();

    mockExtractText.mockResolvedValue({
      text: ['page one', 'page two'],
      totalPages: 2,
    });

    const request = buildFileRequest(
      makeFile('%PDF-1.4 fake', 'doc.pdf', 'application/pdf')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe('pdf');
    expect(data.text).toBe('page one\n\npage two');
    expect(data.metadata.pageCount).toBe(2);
    expect(mockExtractText).toHaveBeenCalled();
  });

  it('should process a PDF file when unpdf returns a single string', async () => {
    setAuthenticatedUser();

    mockExtractText.mockResolvedValue({
      text: 'single string body',
      totalPages: 1,
    });

    const request = buildFileRequest(
      makeFile('%PDF-1.4 fake', 'doc.pdf', 'application/pdf')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.text).toBe('single string body');
    expect(data.metadata.pageCount).toBe(1);
  });

  it('should process a DOCX file via mammoth', async () => {
    setAuthenticatedUser();

    mockExtractRawText.mockResolvedValue({ value: 'docx extracted text' });

    const request = buildFileRequest(
      makeFile(
        'PK fake docx',
        'doc.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe('docx');
    expect(data.text).toBe('docx extracted text');
    expect(mockExtractRawText).toHaveBeenCalled();
  });

  it('should process an image file and return base64 data URL', async () => {
    setAuthenticatedUser();

    const request = buildFileRequest(
      makeFile('rawbytes', 'pic.png', 'image/png')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.type).toBe('image');
    expect(data.text).toBe('');
    expect(typeof data.imageData).toBe('string');
    expect(data.imageData.startsWith('data:image/png;base64,')).toBe(true);
    expect(data.metadata.mimeType).toBe('image/png');
  });

  it('should return 500 when extraction throws', async () => {
    setAuthenticatedUser();

    mockExtractText.mockRejectedValue(new Error('corrupt pdf'));

    const request = buildFileRequest(
      makeFile('%PDF-1.4 fake', 'doc.pdf', 'application/pdf')
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to process file');
  });
});
