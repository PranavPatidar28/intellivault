import { renderHook, act } from '@testing-library/react';
import { useSemanticSearch } from '@/hooks/use-semantic-search';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

global.fetch = jest.fn();
const okJson = (data: any, ok = true) => ({ ok, json: async () => data });

const sampleResults = [
  { id: 'n1', title: 'A', score: 0.9 },
  { id: 'n2', title: 'B', score: 0.8 },
];

describe('useSemanticSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes empty', () => {
    const { result } = renderHook(() => useSemanticSearch());
    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('clears results and skips fetch for blank/whitespace query', async () => {
    const { result } = renderHook(() => useSemanticSearch());
    await act(async () => {
      await result.current.search('   ');
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  it('performs a search and stores results on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, results: sampleResults })
    );

    const { result } = renderHook(() => useSemanticSearch());
    await act(async () => {
      await result.current.search('hello world');
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/notes/search?q=hello%20world');
    expect(result.current.results).toEqual(sampleResults);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error and toasts when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({}, false));

    const { result } = renderHook(() => useSemanticSearch());
    await act(async () => {
      await result.current.search('q');
    });

    expect(result.current.error).toBe('Failed to perform search');
    expect(result.current.results).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('throws the API error when success:false with an error string', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: false, error: 'index missing' })
    );

    const { result } = renderHook(() => useSemanticSearch());
    await act(async () => {
      await result.current.search('q');
    });

    expect(result.current.error).toBe('index missing');
    expect(result.current.results).toEqual([]);
  });

  it('handles success:false with no error string by clearing results without error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false }));

    const { result } = renderHook(() => useSemanticSearch());
    await act(async () => {
      await result.current.search('q');
    });

    // No error thrown (data.error falsy), results cleared.
    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error on network rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useSemanticSearch());
    await act(async () => {
      await result.current.search('q');
    });

    expect(result.current.error).toBe('boom');
    expect(result.current.results).toEqual([]);
  });

  it('setQuery updates the query value', () => {
    const { result } = renderHook(() => useSemanticSearch());
    act(() => {
      result.current.setQuery('typed');
    });
    expect(result.current.query).toBe('typed');
  });

  it('clear resets query, results and error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({}, false));
    const { result } = renderHook(() => useSemanticSearch());

    act(() => {
      result.current.setQuery('typed');
    });
    await act(async () => {
      await result.current.search('q');
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clear();
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
