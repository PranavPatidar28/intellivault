import { renderHook, waitFor, act } from '@testing-library/react';
import { useMedia } from '@/hooks/use-media';

global.fetch = jest.fn();

const okJson = (data: any, ok = true) => ({ ok, json: async () => data });

// Build N media items with sequential ids/urls.
const makeItems = (n: number, prefix = 'm') =>
  Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`,
    url: `https://blob/${prefix}${i}.png`,
    pathname: `${prefix}${i}.png`,
    filename: `${prefix}${i}.png`,
    mimeType: 'image/png',
    fileType: 'IMAGE',
    size: 100,
    sizeFormatted: '100 B',
  }));

describe('useMedia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches media on mount with default params and exposes results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: makeItems(2) }));

    const { result } = renderHook(() => useMedia());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.media).toHaveLength(2);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/files?limit=20&offset=0');
  });

  it('includes fileType in the query when set via options', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: [] }));

    renderHook(() => useMedia({ initialFileType: 'IMAGE' as any, limit: 10 }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/files?limit=10&offset=0&fileType=IMAGE')
    );
  });

  it('sets hasMore false when fewer than limit returned', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: makeItems(3) }));
    const { result } = renderHook(() => useMedia({ limit: 20 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it('sets hasMore true when exactly limit returned', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: makeItems(2) }));
    const { result } = renderHook(() => useMedia({ limit: 2 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(true);
  });

  it('sets error when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ error: 'server boom' }, false)
    );
    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('server boom');
    expect(result.current.media).toEqual([]);
  });

  it('sets error on network rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('network');
  });

  it('defaults media to empty array when data field is missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({}));
    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.media).toEqual([]);
  });

  it('loadMore appends a second page', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okJson({ data: makeItems(2, 'a') })) // mount, limit 2 -> hasMore true
      .mockResolvedValueOnce(okJson({ data: makeItems(1, 'b') })); // loadMore page

    const { result } = renderHook(() => useMedia({ limit: 2 }));
    await waitFor(() => expect(result.current.media).toHaveLength(2));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.media).toHaveLength(3);
    // second call should request offset=2
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('/api/files?limit=2&offset=2');
  });

  it('loadMore is a no-op when hasMore is false', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: makeItems(1) }));
    const { result } = renderHook(() => useMedia({ limit: 20 }));
    await waitFor(() => expect(result.current.hasMore).toBe(false));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refresh refetches from offset 0', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okJson({ data: makeItems(1, 'a') }))
      .mockResolvedValueOnce(okJson({ data: makeItems(2, 'b') }));

    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.media).toHaveLength(1));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.media).toHaveLength(2);
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toBe('/api/files?limit=20&offset=0');
  });

  it('deleteMedia removes the item from local state on success', async () => {
    const items = makeItems(2);
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: items }));

    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.media).toHaveLength(2));

    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    let ok: any;
    await act(async () => {
      ok = await result.current.deleteMedia(items[0].url);
    });

    expect(ok).toBe(true);
    expect(result.current.media.map((m) => m.url)).toEqual([items[1].url]);
    expect((global.fetch as jest.Mock).mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
  });

  it('deleteMedia returns false and keeps state on failure', async () => {
    const items = makeItems(2);
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: items }));

    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.media).toHaveLength(2));

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ error: 'cannot delete' }, false)
    );

    let ok: any;
    await act(async () => {
      ok = await result.current.deleteMedia(items[0].url);
    });

    expect(ok).toBe(false);
    expect(result.current.media).toHaveLength(2);
  });

  it('deleteMultiple returns count of successful deletes', async () => {
    const items = makeItems(3);
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: items }));

    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.media).toHaveLength(3));

    // first two delete ok, third fails (not ok)
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce(okJson({ error: 'x' }, false));

    let count: any;
    await act(async () => {
      count = await result.current.deleteMultiple(items.map((i) => i.url));
    });

    expect(count).toBe(2);
  });

  it('renameMedia updates the filename in local state', async () => {
    const items = makeItems(2);
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ data: items }));

    const { result } = renderHook(() => useMedia());
    await waitFor(() => expect(result.current.media).toHaveLength(2));

    act(() => {
      result.current.renameMedia(items[0].id, 'renamed.png');
    });

    expect(result.current.media.find((m) => m.id === items[0].id)?.filename).toBe('renamed.png');
  });

  it('refetches when fileType changes via setFileType', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okJson({ data: makeItems(1) }))
      .mockResolvedValueOnce(okJson({ data: makeItems(1, 'v') }));

    const { result } = renderHook(() => useMedia({ limit: 5 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFileType('VIDEO' as any);
    });

    await waitFor(() =>
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2)
    );
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('fileType=VIDEO');
  });
});
