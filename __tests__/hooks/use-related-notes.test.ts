import { renderHook, act } from '@testing-library/react';
import { useRelatedNotes } from '@/hooks/use-related-notes';

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

global.fetch = jest.fn();
const okJson = (data: any, ok = true) => ({ ok, json: async () => data });

describe('useRelatedNotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes empty', () => {
    const { result } = renderHook(() => useRelatedNotes());
    expect(result.current.relatedNotes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('skips searching when content is missing or too short (< 10 chars)', async () => {
    const { result } = renderHook(() => useRelatedNotes());

    await act(async () => {
      await result.current.findRelated('note1', 'short');
    });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.findRelated('note1', '');
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches related notes and filters out the current note', async () => {
    const results = [
      { id: 'note1', title: 'self', score: 1 },
      { id: 'note2', title: 'other', score: 0.7 },
    ];
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, results })
    );

    const { result } = renderHook(() => useRelatedNotes());
    await act(async () => {
      await result.current.findRelated('note1', 'this is long enough content');
    });

    expect(result.current.relatedNotes).toEqual([{ id: 'note2', title: 'other', score: 0.7 }]);
    expect(result.current.isLoading).toBe(false);
  });

  it('truncates the query to the first 500 chars of content', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, results: [] }));
    const content = 'x'.repeat(600);

    const { result } = renderHook(() => useRelatedNotes());
    await act(async () => {
      await result.current.findRelated('n', content);
    });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    const encoded = decodeURIComponent(calledUrl.split('q=')[1].split('&')[0]);
    expect(encoded).toHaveLength(500);
    expect(calledUrl).toContain('limit=5');
  });

  it('leaves results empty when success:false', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false }));

    const { result } = renderHook(() => useRelatedNotes());
    await act(async () => {
      await result.current.findRelated('n', 'long enough content here');
    });

    expect(result.current.relatedNotes).toEqual([]);
  });

  it('fails silently on network rejection (no toast)', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useRelatedNotes());
    await act(async () => {
      await result.current.findRelated('n', 'long enough content here');
    });

    expect(result.current.relatedNotes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('clear resets related notes', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, results: [{ id: 'note2', title: 'other' }] })
    );

    const { result } = renderHook(() => useRelatedNotes());
    await act(async () => {
      await result.current.findRelated('note1', 'long enough content here');
    });
    expect(result.current.relatedNotes).toHaveLength(1);

    act(() => {
      result.current.clear();
    });
    expect(result.current.relatedNotes).toEqual([]);
  });
});
