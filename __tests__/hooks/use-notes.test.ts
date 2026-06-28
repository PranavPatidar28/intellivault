import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotes } from '@/hooks/use-notes';

// Mock fetch globally
global.fetch = jest.fn();

describe('useNotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      new Promise(() => {}) // Never resolves to keep loading state
    );

    const { result } = renderHook(() => useNotes());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.notes).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch notes successfully', async () => {
    const mockNotes = [
      {
        id: '1',
        title: 'Test Note 1',
        contentJSON: { type: 'doc' },
        contentText: 'Content 1',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
      {
        id: '2',
        title: 'Test Note 2',
        contentJSON: { type: 'doc' },
        contentText: 'Content 2',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02',
      },
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, notes: mockNotes }),
    });

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notes).toEqual(mockNotes);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Failed to fetch notes' }),
    });

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notes).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch notes');
  });

  it('should handle network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notes).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch notes');
  });

  it('should call API with correct pagination parameters', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, notes: [] }),
    });

    renderHook(() => useNotes());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/notes?page=1&limit=100');
    });
  });

  it('should support refetch functionality', async () => {
    const mockNotes = [
      {
        id: '1',
        title: 'Test Note',
        contentJSON: { type: 'doc' },
        contentText: 'Content',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ];

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, notes: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, notes: mockNotes }),
      });

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.notes).toEqual([]);

    // Call refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.notes).toEqual(mockNotes);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should set loading state during refetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, notes: [] }),
    });

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start refetch inside act so the synchronous setIsLoading(true) flushes,
    // but don't await yet so we can observe the in-flight loading state.
    let refetchPromise: Promise<void>;
    act(() => {
      refetchPromise = result.current.refetch();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await refetchPromise;
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should only fetch once on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, notes: [] }),
    });

    renderHook(() => useNotes());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it('should clear error on successful refetch', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Error occurred' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, notes: [] }),
      });

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.error).toBe('Error occurred');
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
  });
});
