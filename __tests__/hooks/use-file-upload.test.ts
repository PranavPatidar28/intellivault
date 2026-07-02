import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useFileUpload,
  SUPPORTED_FILE_TYPES,
} from '@/hooks/use-file-upload';

// Mock the toast layer so we can assert success/error notifications without
// pulling in sonner's real implementation.
const toastError = jest.fn();
const toastSuccess = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

global.fetch = jest.fn();

/** Build a File with a controllable `type` and `size`. */
function makeFile(
  name: string,
  type: string,
  size = 1024
): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** Minimal React.DragEvent stub recording preventDefault/stopPropagation. */
function makeDragEvent(
  overrides: Partial<{
    files: File[];
    currentTarget: { contains: (n: unknown) => boolean };
    relatedTarget: unknown;
  }> = {}
) {
  const preventDefault = jest.fn();
  const stopPropagation = jest.fn();
  return {
    preventDefault,
    stopPropagation,
    dataTransfer: { files: overrides.files ?? [] },
    currentTarget:
      overrides.currentTarget ?? { contains: () => false },
    relatedTarget: overrides.relatedTarget ?? null,
  } as unknown as React.DragEvent;
}

describe('useFileUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes the supported file types map', () => {
    expect(SUPPORTED_FILE_TYPES['text/plain'].ext).toBe('.txt');
    expect(SUPPORTED_FILE_TYPES['application/pdf'].label).toBe('PDF');
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useFileUpload());
    expect(result.current.isDragging).toBe(false);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.uploadError).toBeNull();
    expect(result.current.processedFile).toBeNull();
  });

  it('rejects an unsupported file type without fetching', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleFileSelect(
        makeFile('x.exe', 'application/x-msdownload')
      );
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.uploadError).toContain('Unsupported file type');
    expect(toastError).toHaveBeenCalledWith(
      'Unsupported file type',
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  it('reports "unknown" when the file type is empty', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleFileSelect(makeFile('blob', ''));
    });

    expect(result.current.uploadError).toBe('Unsupported file type: unknown');
  });

  it('rejects a file larger than 10MB', async () => {
    const { result } = renderHook(() => useFileUpload());
    const big = makeFile('big.txt', 'text/plain', 11 * 1024 * 1024);

    await act(async () => {
      await result.current.handleFileSelect(big);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.uploadError).toBe(
      'File too large. Maximum size is 10MB.'
    );
    expect(toastError).toHaveBeenCalledWith(
      'File too large',
      expect.any(Object)
    );
  });

  it('uploads a valid file and stores the processed result', async () => {
    const processed = {
      type: 'text',
      text: 'hello world',
      imageData: undefined,
      metadata: { filename: 'note.txt', mimeType: 'text/plain', size: 1024 },
    };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => processed,
    });

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleFileSelect(
        makeFile('note.txt', 'text/plain')
      );
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/ai-dump/upload',
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.current.processedFile).toEqual(processed);
    expect(result.current.isUploading).toBe(false);
    expect(result.current.uploadError).toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith(
      'File processed',
      expect.objectContaining({ description: expect.stringContaining('note.txt') })
    );
  });

  it('surfaces a server error message from a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server exploded' }),
    });

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleFileSelect(
        makeFile('note.txt', 'text/plain')
      );
    });

    expect(result.current.uploadError).toBe('Server exploded');
    expect(result.current.processedFile).toBeNull();
    expect(toastError).toHaveBeenCalledWith('Upload failed', expect.any(Object));
  });

  it('falls back to a generic message when error response lacks one', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleFileSelect(
        makeFile('note.txt', 'text/plain')
      );
    });

    expect(result.current.uploadError).toBe('Upload failed');
  });

  it('handles a network rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network down')
    );

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleFileSelect(
        makeFile('note.txt', 'text/plain')
      );
    });

    expect(result.current.uploadError).toBe('Network down');
  });

  it('handleDragEnter sets dragging and prevents default', () => {
    const { result } = renderHook(() => useFileUpload());
    const ev = makeDragEvent();

    act(() => result.current.handleDragEnter(ev));

    expect(result.current.isDragging).toBe(true);
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(ev.stopPropagation).toHaveBeenCalled();
  });

  it('handleDragLeave clears dragging when leaving the drop zone', () => {
    const { result } = renderHook(() => useFileUpload());
    act(() => result.current.handleDragEnter(makeDragEvent()));
    expect(result.current.isDragging).toBe(true);

    const ev = makeDragEvent({ currentTarget: { contains: () => false } });
    act(() => result.current.handleDragLeave(ev));
    expect(result.current.isDragging).toBe(false);
  });

  it('handleDragLeave keeps dragging when moving to a child element', () => {
    const { result } = renderHook(() => useFileUpload());
    act(() => result.current.handleDragEnter(makeDragEvent()));

    const ev = makeDragEvent({ currentTarget: { contains: () => true } });
    act(() => result.current.handleDragLeave(ev));
    // still dragging because the pointer moved to a descendant
    expect(result.current.isDragging).toBe(true);
  });

  it('handleDragOver just prevents default', () => {
    const { result } = renderHook(() => useFileUpload());
    const ev = makeDragEvent();
    act(() => result.current.handleDragOver(ev));
    expect(ev.preventDefault).toHaveBeenCalled();
    expect(ev.stopPropagation).toHaveBeenCalled();
  });

  it('handleDrop uploads the first dropped file', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: 'text',
        text: 't',
        metadata: { filename: 'd.txt', mimeType: 'text/plain', size: 1 },
      }),
    });

    const { result } = renderHook(() => useFileUpload());
    const ev = makeDragEvent({ files: [makeFile('d.txt', 'text/plain')] });

    await act(async () => {
      result.current.handleDrop(ev);
    });

    expect(result.current.isDragging).toBe(false);
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/ai-dump/upload',
        expect.any(Object)
      )
    );
  });

  it('handleDrop is a no-op when no files are dropped', () => {
    const { result } = renderHook(() => useFileUpload());
    const ev = makeDragEvent({ files: [] });

    act(() => result.current.handleDrop(ev));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.isDragging).toBe(false);
  });

  it('openFilePicker clicks the underlying input', () => {
    const { result } = renderHook(() => useFileUpload());
    const click = jest.fn();
    // Attach a fake input element to the ref.
    (result.current.fileInputRef as React.MutableRefObject<unknown>).current = {
      click,
      value: '',
    };

    act(() => result.current.openFilePicker());
    expect(click).toHaveBeenCalled();
  });

  it('clearFile resets processed file, error, and the input value', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        type: 'text',
        text: 't',
        metadata: { filename: 'd.txt', mimeType: 'text/plain', size: 1 },
      }),
    });

    const { result } = renderHook(() => useFileUpload());
    const input = { value: 'something' };
    (result.current.fileInputRef as React.MutableRefObject<unknown>).current =
      input;

    await act(async () => {
      await result.current.handleFileSelect(makeFile('d.txt', 'text/plain'));
    });
    expect(result.current.processedFile).not.toBeNull();

    act(() => result.current.clearFile());

    expect(result.current.processedFile).toBeNull();
    expect(result.current.uploadError).toBeNull();
    expect(input.value).toBe('');
  });
});
