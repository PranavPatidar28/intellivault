import { renderHook, act } from '@testing-library/react';
import { useMediaPicker } from '@/hooks/use-media-picker';
import type { MediaItem } from '@/hooks/use-media';

/**
 * Build a minimal TipTap editor stub exposing only what the hook touches:
 * `isEditable` and a `chain().focus().insertContent().run()` fluent API.
 */
function makeEditorStub(opts: { isEditable?: boolean } = {}) {
  const insertContent = jest.fn().mockReturnThis();
  const focus = jest.fn().mockReturnThis();
  const run = jest.fn();
  const chain = jest.fn(() => ({ focus, insertContent, run }));
  // focus() and insertContent() must return the same chain object.
  focus.mockImplementation(() => ({ focus, insertContent, run }));
  insertContent.mockImplementation(() => ({ focus, insertContent, run }));

  const editor = {
    isEditable: opts.isEditable ?? true,
    chain,
  };
  return { editor: editor as any, chain, focus, insertContent, run };
}

function mediaItem(partial: Partial<MediaItem>): MediaItem {
  return {
    id: 'm1',
    url: 'https://cdn.example.com/file',
    pathname: '/file',
    filename: 'file',
    mimeType: 'application/octet-stream',
    fileType: 'IMAGE',
    size: 1234,
    sizeFormatted: '1.2 KB',
    ...partial,
  } as MediaItem;
}

describe('useMediaPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts closed and exposes config defaults', () => {
    const { editor } = makeEditorStub();
    const { result } = renderHook(() => useMediaPicker({ editor }));

    expect(result.current.isOpen).toBe(false);
    expect(result.current.multiSelect).toBe(true);
    expect(result.current.allowedTypes).toBeUndefined();
  });

  it('passes through allowedTypes and multiSelect overrides', () => {
    const { editor } = makeEditorStub();
    const { result } = renderHook(() =>
      useMediaPicker({ editor, allowedTypes: ['IMAGE'], multiSelect: false })
    );

    expect(result.current.allowedTypes).toEqual(['IMAGE']);
    expect(result.current.multiSelect).toBe(false);
  });

  it('open() sets isOpen true when the editor is editable', () => {
    const { editor } = makeEditorStub({ isEditable: true });
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it('open() is a no-op when the editor is not editable', () => {
    const { editor } = makeEditorStub({ isEditable: false });
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(false);
  });

  it('open() is a no-op when the editor is null', () => {
    const { result } = renderHook(() => useMediaPicker({ editor: null }));

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(false);
  });

  it('close() sets isOpen false', () => {
    const { editor } = makeEditorStub();
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });

  it('handleSelect does nothing when editor is null', () => {
    const { result } = renderHook(() => useMediaPicker({ editor: null }));
    // Should not throw.
    act(() => result.current.handleSelect([mediaItem({ fileType: 'IMAGE' })]));
  });

  it('handleSelect does nothing for an empty selection', () => {
    const { editor, chain } = makeEditorStub();
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() => result.current.handleSelect([]));
    expect(chain).not.toHaveBeenCalled();
  });

  it('inserts an image node for IMAGE items', () => {
    const { editor, chain, insertContent, run } = makeEditorStub();
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() =>
      result.current.handleSelect([
        mediaItem({
          fileType: 'IMAGE',
          url: 'https://cdn/img.png',
          filename: 'img.png',
        }),
      ])
    );

    expect(chain).toHaveBeenCalled();
    expect(insertContent).toHaveBeenCalledWith([
      {
        type: 'image',
        attrs: {
          src: 'https://cdn/img.png',
          alt: 'img.png',
          title: 'img.png',
        },
      },
    ]);
    expect(run).toHaveBeenCalled();
  });

  it('inserts video and audio nodes with the correct shape', () => {
    const { editor, insertContent } = makeEditorStub();
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() =>
      result.current.handleSelect([
        mediaItem({ fileType: 'VIDEO', url: 'v.mp4', filename: 'v.mp4' }),
        mediaItem({ fileType: 'AUDIO', url: 'a.mp3', filename: 'a.mp3' }),
      ])
    );

    expect(insertContent).toHaveBeenCalledWith([
      { type: 'video', attrs: { src: 'v.mp4', title: 'v.mp4' } },
      { type: 'audio', attrs: { src: 'a.mp3', title: 'a.mp3' } },
    ]);
  });

  it('filters out unsupported file types and does not insert when none remain', () => {
    const { editor, chain } = makeEditorStub();
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() =>
      result.current.handleSelect([
        mediaItem({ fileType: 'DOCUMENT' as MediaItem['fileType'] }),
      ])
    );

    // All items mapped to null -> nodes empty -> chain never invoked.
    expect(chain).not.toHaveBeenCalled();
  });

  it('inserts only the supported nodes when the selection is mixed', () => {
    const { editor, insertContent } = makeEditorStub();
    const { result } = renderHook(() => useMediaPicker({ editor }));

    act(() =>
      result.current.handleSelect([
        mediaItem({ fileType: 'IMAGE', url: 'i.png', filename: 'i.png' }),
        mediaItem({ fileType: 'DOCUMENT' as MediaItem['fileType'] }),
      ])
    );

    expect(insertContent).toHaveBeenCalledWith([
      {
        type: 'image',
        attrs: { src: 'i.png', alt: 'i.png', title: 'i.png' },
      },
    ]);
  });
});
