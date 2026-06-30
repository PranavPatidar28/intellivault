import { renderHook, act } from '@testing-library/react';
import { useTagOperations } from '@/hooks/useTagOperations';

// Mock sonner toast (the hook imports it directly).
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { toast } from 'sonner';

global.fetch = jest.fn();

const okJson = (data: any) => ({
  ok: true,
  json: async () => data,
});

describe('useTagOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useTagOperations());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  // ---- createTag ----
  describe('createTag', () => {
    it('creates a tag on success and returns it', async () => {
      const tag = { id: 't1', name: 'work' };
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, tag }));

      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.createTag('work', '#fff', 'parent1');
      });

      expect(returned).toEqual(tag);
      expect(global.fetch).toHaveBeenCalledWith('/api/tags', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'work', color: '#fff', parentId: 'parent1' }),
      }));
      expect(toast.success).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('handles API failure (success:false) with the returned error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false, error: 'dup name' }));

      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.createTag('work');
      });

      expect(returned).toBeNull();
      expect(result.current.error).toBe('dup name');
      expect(toast.error).toHaveBeenCalledWith('Error', { description: 'dup name' });
    });

    it('handles network rejection with fallback message', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.createTag('work');
      });

      expect(returned).toBeNull();
      expect(result.current.error).toBe('network down');
    });

    it('uses fallback message when success:false has no error string', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false }));

      const { result } = renderHook(() => useTagOperations());
      await act(async () => {
        await result.current.createTag('work');
      });

      expect(result.current.error).toBe('Failed to create tag');
    });
  });

  // ---- updateTag ----
  describe('updateTag', () => {
    it('updates a tag and returns the result tag', async () => {
      const tag = { id: 't1', name: 'renamed' };
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, tag }));

      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.updateTag('t1', { name: 'renamed' });
      });

      expect(returned).toEqual(tag);
      expect(global.fetch).toHaveBeenCalledWith('/api/tags/t1', expect.objectContaining({ method: 'PATCH' }));
      expect(toast.success).toHaveBeenCalledWith('Tag updated');
    });

    it('returns null and sets error on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false, error: 'nope' }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.updateTag('t1', { name: 'x' });
      });
      expect(returned).toBeNull();
      expect(result.current.error).toBe('nope');
    });
  });

  // ---- deleteTag ----
  describe('deleteTag', () => {
    it('returns true on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.deleteTag('t1');
      });
      expect(returned).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/tags/t1', { method: 'DELETE' });
      expect(toast.success).toHaveBeenCalledWith('Tag deleted');
    });

    it('returns false and sets error on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false, error: 'in use' }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.deleteTag('t1');
      });
      expect(returned).toBe(false);
      expect(result.current.error).toBe('in use');
    });

    it('returns false on network rejection', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('boom'));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.deleteTag('t1');
      });
      expect(returned).toBe(false);
    });
  });

  // ---- toggleFavorite / toggleArchive ----
  describe('toggleFavorite', () => {
    it('returns true on success and hits the favorite endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.toggleFavorite('t1');
      });
      expect(returned).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/tags/favorite/t1', { method: 'POST' });
    });

    it('returns false on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.toggleFavorite('t1');
      });
      expect(returned).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('toggleArchive', () => {
    it('returns true on success and hits the archive endpoint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.toggleArchive('t1');
      });
      expect(returned).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/tags/archive/t1', { method: 'POST' });
    });

    it('returns false on rejection', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('x'));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.toggleArchive('t1');
      });
      expect(returned).toBe(false);
    });
  });

  // ---- bulkDelete (progress lifecycle) ----
  describe('bulkDelete', () => {
    it('sets progress to completed and returns deletedCount on success', async () => {
      jest.useFakeTimers();
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, deletedCount: 2 }));

      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.bulkDelete(['a', 'b']);
      });

      expect(returned).toBe(2);
      expect(result.current.progress).toEqual({
        total: 2,
        completed: 2,
        failed: 0,
        status: 'completed',
      });

      // progress auto-clears after 3s
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.progress).toBeNull();
    });

    it('sets progress status to error and returns 0 on failure', async () => {
      jest.useFakeTimers();
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false, error: 'fail' }));

      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.bulkDelete(['a', 'b']);
      });

      expect(returned).toBe(0);
      expect(result.current.progress?.status).toBe('error');
      expect(result.current.error).toBe('fail');
    });
  });

  // ---- bulkRecolor / bulkArchive / bulkFavorite ----
  describe('bulk simple operations', () => {
    it('bulkRecolor returns updatedCount and posts recolor', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, updatedCount: 3 }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.bulkRecolor(['a', 'b', 'c'], '#123456');
      });
      expect(returned).toBe(3);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).toEqual({ tagIds: ['a', 'b', 'c'], operation: 'recolor', color: '#123456' });
    });

    it('bulkRecolor returns 0 on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.bulkRecolor(['a'], '#000');
      });
      expect(returned).toBe(0);
    });

    it('bulkArchive returns updatedCount on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, updatedCount: 5 }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.bulkArchive(['a']);
      });
      expect(returned).toBe(5);
    });

    it('bulkArchive returns 0 on rejection', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('x'));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.bulkArchive(['a']);
      });
      expect(returned).toBe(0);
    });

    it('bulkFavorite returns updatedCount on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, updatedCount: 1 }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.bulkFavorite(['a']);
      });
      expect(returned).toBe(1);
    });
  });

  // ---- mergeTags ----
  describe('mergeTags', () => {
    it('returns mergedNotesCount and completes progress on success', async () => {
      jest.useFakeTimers();
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: true, mergedNotesCount: 7 }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.mergeTags(['s1', 's2'], 'target');
      });
      expect(returned).toBe(7);
      expect(result.current.progress?.status).toBe('completed');
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body).toEqual({ sourceTagIds: ['s1', 's2'], targetTagId: 'target' });
    });

    it('returns null (not 0) on failure to distinguish from a zero-note merge', async () => {
      jest.useFakeTimers();
      (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ success: false, error: 'merge fail' }));
      const { result } = renderHook(() => useTagOperations());
      let returned: any;
      await act(async () => {
        returned = await result.current.mergeTags(['s1'], 'target');
      });
      expect(returned).toBeNull();
      expect(result.current.progress?.status).toBe('error');
      expect(result.current.error).toBe('merge fail');
    });
  });
});
