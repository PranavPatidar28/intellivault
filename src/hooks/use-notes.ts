import { useState, useEffect, useRef } from 'react';
import { Note } from '@/types/note';

interface UseNotesResult {
  notes: Note[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
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
  };
}