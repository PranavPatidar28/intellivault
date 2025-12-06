"use client";

import { useState, useCallback } from "react";
import { SemanticSearchResult, SemanticSearchResponse } from "@/types/note";
import { useToast } from "@/hooks/use-toast";

interface UseRelatedNotesReturn {
    relatedNotes: SemanticSearchResult[];
    isLoading: boolean;
    findRelated: (noteId: string, content: string) => Promise<void>;
    clear: () => void;
}

export function useRelatedNotes(): UseRelatedNotesReturn {
    const [relatedNotes, setRelatedNotes] = useState<SemanticSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const findRelated = useCallback(async (noteId: string, content: string) => {
        // Don't search if content is too short
        if (!content || content.length < 10) return;

        setIsLoading(true);
        setRelatedNotes([]);

        try {
            // Use the first 500 characters of content + title for search query
            // This is a simple heuristic for "likeness"
            const query = content.slice(0, 500);

            const response = await fetch(`/api/notes/search?q=${encodeURIComponent(query)}&limit=5`);
            const data: SemanticSearchResponse = await response.json();

            if (data.success) {
                // Filter out the current note from results
                const filtered = data.results.filter(n => n.id !== noteId);
                setRelatedNotes(filtered);
            }
        } catch (err) {
            console.error("Failed to find related notes", err);
            // Fail silently for related notes, don't nag user
        } finally {
            setIsLoading(false);
        }
    }, []);

    const clear = useCallback(() => {
        setRelatedNotes([]);
    }, []);

    return {
        relatedNotes,
        isLoading,
        findRelated,
        clear,
    };
}
