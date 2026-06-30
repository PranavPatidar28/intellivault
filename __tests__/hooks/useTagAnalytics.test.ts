import { renderHook, waitFor, act } from '@testing-library/react';
import { useTagAnalytics } from '@/hooks/useTagAnalytics';

global.fetch = jest.fn();

const okJson = (data: any) => ({ ok: true, json: async () => data });

const sampleAnalytics = {
  totalTags: 10,
  totalNotes: 5,
  mostUsedTags: [],
};

describe('useTagAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('fetches analytics on mount and exposes them', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, analytics: sampleAnalytics })
    );

    const { result } = renderHook(() => useTagAnalytics());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.analytics).toEqual(sampleAnalytics);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/tags/analytics');
  });

  it('sets error when API returns success:false', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: false, error: 'no analytics' })
    );

    const { result } = renderHook(() => useTagAnalytics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.analytics).toBeNull();
    expect(result.current.error).toBe('no analytics');
  });

  it('uses fallback message when success:false has no error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false }));
    const { result } = renderHook(() => useTagAnalytics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch analytics');
  });

  it('sets error on network rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useTagAnalytics());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('offline');
    expect(result.current.analytics).toBeNull();
  });

  it('refetch re-runs the request and clears prior error', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okJson({ success: false, error: 'first fail' }))
      .mockResolvedValueOnce(okJson({ success: true, analytics: sampleAnalytics }));

    const { result } = renderHook(() => useTagAnalytics());
    await waitFor(() => expect(result.current.error).toBe('first fail'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.analytics).toEqual(sampleAnalytics));
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not auto-refresh when autoRefresh is false (default)', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue(
      okJson({ success: true, analytics: sampleAnalytics })
    );

    renderHook(() => useTagAnalytics());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      jest.advanceTimersByTime(120000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('auto-refreshes on the configured interval when enabled', async () => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock).mockResolvedValue(
      okJson({ success: true, analytics: sampleAnalytics })
    );

    renderHook(() => useTagAnalytics({ autoRefresh: true, refreshInterval: 1000 }));

    // initial mount fetch
    await act(async () => {
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
