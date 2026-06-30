import { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '@/types/note';

const PAGE_SIZE = 100; // Matches the API's max page size

interface NotesApiResult {
  success: boolean;
  notes?: Note[];
  total?: number;
  totalPages?: number;
  error?: string;
}

interface UseNotesResult {
  notes: Note[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  refetch: (options?: { silent?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  optimisticTogglePin: (id: string) => void;
  optimisticRemoveNote: (id: string) => Note | undefined;
  restoreNote: (note: Note, index: number) => void;
}

async function fetchNotesFromAPI(page: number): Promise<NotesApiResult> {
  try {
    const response = await fetch(`/api/notes?page=${page}&limit=${PAGE_SIZE}`);
    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        notes: data.notes,
        total: data.metadata?.total,
        totalPages: data.metadata?.totalPages,
      };
    } else {
      return { success: false, error: data.error };
    }
  } catch {
    return { success: false, error: "Failed to fetch notes" };
  }
}

export function useNotes(): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Set when a loadMore page comes back short/empty, meaning the server has no
  // more rows even though offsets have drifted (e.g. after optimistic deletes).
  // Without this, hasMore could stay true forever once notes.length < total
  // can no longer be satisfied by paging.
  const [exhausted, setExhausted] = useState(false);
  const initialFetchDone = useRef(false);
  // Mirrors `page` so refetch can rebuild the full paged-in range without
  // collapsing the list back to page 1.
  const pageRef = useRef(1);

  const fetchNotes = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }
    setError(null);

    // Re-fetch every page the user has paged into (1..currentPage) so a
    // silent refetch after a create doesn't collapse a long list back to 100.
    const pagesToFetch = Math.max(1, pageRef.current);
    const results = await Promise.all(
      Array.from({ length: pagesToFetch }, (_, i) => fetchNotesFromAPI(i + 1))
    );

    const firstFailure = results.find((r) => !r.success);
    const anySuccess = results.some((r) => r.success && r.notes);

    if (anySuccess) {
      // Merge all pages with de-dupe, preserving order.
      const merged: Note[] = [];
      const seen = new Set<string>();
      let latestTotal: number | undefined;
      for (const result of results) {
        if (result.total !== undefined) latestTotal = result.total;
        if (!result.notes) continue;
        for (const n of result.notes) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          merged.push(n);
        }
      }
      setNotes(merged);
      setTotal(latestTotal ?? merged.length);
      // Fresh full refetch resets the exhausted guard.
      setExhausted(false);
    } else {
      setError(firstFailure?.error || "Unknown error occurred");
    }

    setIsLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    const nextPage = page + 1;
    const result = await fetchNotesFromAPI(nextPage);

    if (result.success && result.notes) {
      // De-dupe in case a note shifted pages between requests
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        const incoming = result.notes!.filter((n) => !seen.has(n.id));
        return [...prev, ...incoming];
      });
      if (result.total !== undefined) setTotal(result.total);
      // A short or empty page means the server has nothing more to give, even
      // if notes.length < total because offsets drifted after deletes.
      if (result.notes.length < PAGE_SIZE) setExhausted(true);
      pageRef.current = nextPage;
      setPage(nextPage);
    } else if (result.error) {
      setError(result.error);
    }

    setIsLoadingMore(false);
  }, [page]);

  // Optimistic update for pin toggle - updates UI instantly
  const optimisticTogglePin = useCallback((id: string) => {
    setNotes(prevNotes =>
      prevNotes.map(note =>
        note.id === id
          ? { ...note, isPinned: !note.isPinned, pinnedAt: !note.isPinned ? new Date().toISOString() : null }
          : note
      )
    );
  }, []);

  // Optimistically remove a note from local state. Returns the removed note and
  // its index so the caller can restore it if the server delete fails.
  const optimisticRemoveNote = useCallback((id: string): Note | undefined => {
    let removed: Note | undefined;
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx === -1) return prev;
      removed = prev[idx];
      return prev.filter((n) => n.id !== id);
    });
    setTotal((t) => (removed ? Math.max(0, t - 1) : t));
    return removed;
  }, []);

  const restoreNote = useCallback((note: Note, index: number) => {
    setNotes((prev) => {
      if (prev.some((n) => n.id === note.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, note);
      return next;
    });
    setTotal((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      void fetchNotes();
    }
  }, [fetchNotes]);

  return {
    notes,
    isLoading,
    isLoadingMore,
    error,
    total,
    hasMore: !exhausted && notes.length < total,
    refetch: fetchNotes,
    loadMore,
    optimisticTogglePin,
    optimisticRemoveNote,
    restoreNote,
  };
}
