import { useState, useEffect, useRef, useCallback } from 'react';
import { Note } from '@/types/note';

interface UseNotesResult {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  optimisticTogglePin: (id: string) => void;
}


async function fetchNotesFromAPI(): Promise<{ success: boolean; notes?: Note[]; error?: string }> {
  try {
    // Add pagination parameters to match API validation
    const response = await fetch(`/api/notes?page=1&limit=100`);
    const data = await response.json();

    if (data.success) {
      return { success: true, notes: data.notes };
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
  const [error, setError] = useState<string | null>(null);
  const initialFetchDone = useRef(false);

  const fetchNotes = async () => {
    setIsLoading(true);
    setError(null);

    const result = await fetchNotesFromAPI();

    if (result.success && result.notes) {
      setNotes(result.notes);
    } else {
      setError(result.error || "Unknown error occurred");
    }

    setIsLoading(false);
  };

  // Optimistic update for pin toggle - updates UI instantly
  const optimisticTogglePin = useCallback((id: string) => {
    setNotes(prevNotes => {
      const updatedNotes = prevNotes.map(note =>
        note.id === id
          ? { ...note, isPinned: !note.isPinned, pinnedAt: !note.isPinned ? new Date().toISOString() : null }
          : note
      );

      // Sort: pinned first, then by pinnedAt desc, then by updatedAt desc
      return updatedNotes.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        if (a.isPinned && b.isPinned) {
          const aTime = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
          const bTime = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
          return bTime - aTime;
        }
        const aUpdated = new Date(a.updatedAt).getTime();
        const bUpdated = new Date(b.updatedAt).getTime();
        return bUpdated - aUpdated;
      });
    });
  }, []);

  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      void fetchNotes();
    }
  }, []);

  return {
    notes,
    isLoading,
    error,
    refetch: fetchNotes,
    optimisticTogglePin,
  };
}