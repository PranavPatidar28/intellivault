import { useState, useCallback } from "react";
import { SemanticSearchResult, SemanticSearchResponse } from "@/types/note";
import { useToast } from "@/hooks/use-toast";

interface UseSemanticSearchReturn {
  query: string;
  results: SemanticSearchResult[];
  isLoading: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
  setQuery: (query: string) => void;
  clear: () => void;
}

export function useSemanticSearch(): UseSemanticSearchReturn {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/search?q=${encodeURIComponent(searchQuery)}`);
      
      if (!response.ok) {
        throw new Error("Failed to perform search");
      }

      const data: SemanticSearchResponse = await response.json();

      if (data.success) {
        setResults(data.results);
      } else {
        setResults([]);
        if (data.error) throw new Error(data.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred while searching";
      setError(message);
      toast({
        title: "Search failed",
        description: message,
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setError(null);
  }, []);

  return {
    query,
    results,
    isLoading,
    error,
    search,
    setQuery,
    clear,
  };
}
