/**
 * AI Features React Hook
 *
 * Provides convenient access to AI summarization and auto-tagging features.
 */

"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

// ============================================================================
// Types
// ============================================================================

export interface SummarizeOptions {
    length?: "short" | "medium" | "long";
    style?: "bullet" | "paragraph" | "tldr";
    includeKeywords?: boolean;
    generateTitle?: boolean;
    force?: boolean;
    /** Enable streaming mode */
    stream?: boolean;
    /** Callback for streaming chunks */
    onChunk?: (chunk: string, accumulated: string) => void;
}

export interface SummarizeResult {
    summary: string;
    generatedTitle?: string;
    keywords?: string[];
    confidence: number;
    cached: boolean;
    provider: string;
    latencyMs?: number;
}

export interface TagSuggestion {
    name: string;
    slug: string;
    confidence: number;
    reason: string;
    isExisting: boolean;
    existingTagId?: string;
    color?: string;
}

export interface AutoTagResult {
    suggestions: TagSuggestion[];
    appliedTags?: string[];
    provider: string;
    latencyMs?: number;
}

// ============================================================================
// useSummarize Hook
// ============================================================================

export interface UseSummarizeReturn {
    summarize: (noteId: string, options?: SummarizeOptions) => Promise<SummarizeResult | null>;
    summarizeStream: (noteId: string, options?: SummarizeOptions) => Promise<string | null>;
    generateTitle: (noteId: string) => Promise<string | null>;
    isLoading: boolean;
    error: string | null;
}

export function useSummarize(): UseSummarizeReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const summarize = useCallback(
        async (noteId: string, options: SummarizeOptions = {}): Promise<SummarizeResult | null> => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/notes/summarize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ noteId, options }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to generate summary");
                }

                return {
                    summary: data.summary,
                    generatedTitle: data.generatedTitle,
                    keywords: data.keywords,
                    confidence: data.confidence,
                    cached: data.cached,
                    provider: data.provider,
                    latencyMs: data.latencyMs,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to generate summary";
                setError(message);
                toast({
                    title: "Summarization failed",
                    description: message,
                    variant: "destructive",
                });
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [toast]
    );

    const summarizeStream = useCallback(
        async (noteId: string, options: SummarizeOptions = {}): Promise<string | null> => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/notes/summarize/stream", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ noteId, options }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to start streaming");
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error("No response body");

                const decoder = new TextDecoder();
                let accumulated = "";
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.startsWith("data: ")) continue;
                        const jsonStr = line.slice(6);
                        if (!jsonStr.trim()) continue;

                        try {
                            const data = JSON.parse(jsonStr);

                            if (data.error) {
                                throw new Error(data.error);
                            }

                            if (data.chunk) {
                                accumulated += data.chunk;
                                options.onChunk?.(data.chunk, accumulated);
                            }

                            if (data.done) {
                                // Streaming complete
                            }
                        } catch (parseErr) {
                            // Skip malformed JSON unless it's our thrown error
                            if (parseErr instanceof Error && parseErr.message !== "Unexpected token") {
                                throw parseErr;
                            }
                        }
                    }
                }

                return accumulated;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to stream summary";
                setError(message);
                toast({
                    title: "Streaming failed",
                    description: message,
                    variant: "destructive",
                });
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [toast]
    );

    const generateTitle = useCallback(
        async (noteId: string): Promise<string | null> => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/notes/summarize?noteId=${noteId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to generate title");
                }

                return data.title;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to generate title";
                setError(message);
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return { summarize, summarizeStream, generateTitle, isLoading, error };
}

// ============================================================================
// useAutoTag Hook
// ============================================================================

export interface UseAutoTagOptions {
    maxSuggestions?: number;
    minConfidence?: number;
    autoApply?: boolean;
    autoApplyThreshold?: number;
}

export interface UseAutoTagReturn {
    suggestTags: (noteId: string, options?: UseAutoTagOptions) => Promise<AutoTagResult | null>;
    applyTags: (noteId: string, tagNames: string[]) => Promise<boolean>;
    isLoading: boolean;
    error: string | null;
}

export function useAutoTag(): UseAutoTagReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const suggestTags = useCallback(
        async (noteId: string, options: UseAutoTagOptions = {}): Promise<AutoTagResult | null> => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/notes/auto-tag", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ noteId, ...options }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to get tag suggestions");
                }

                return {
                    suggestions: data.suggestions,
                    appliedTags: data.appliedTags,
                    provider: data.provider,
                    latencyMs: data.latencyMs,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to get tag suggestions";
                setError(message);
                toast({
                    title: "Auto-tagging failed",
                    description: message,
                    variant: "destructive",
                });
                return null;
            } finally {
                setIsLoading(false);
            }
        },
        [toast]
    );

    const applyTags = useCallback(
        async (noteId: string, tagNames: string[]): Promise<boolean> => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/notes/auto-tag", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ noteId, tagNames }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to apply tags");
                }

                toast({
                    title: "Tags applied",
                    description: `Applied ${data.applied.length} tag(s)${data.created.length > 0 ? `, created ${data.created.length} new tag(s)` : ""}`,
                });

                return true;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Failed to apply tags";
                setError(message);
                toast({
                    title: "Failed to apply tags",
                    description: message,
                    variant: "destructive",
                });
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [toast]
    );

    return { suggestTags, applyTags, isLoading, error };
}

// ============================================================================
// Combined Hook
// ============================================================================

export interface UseAIFeaturesReturn {
    summarize: UseSummarizeReturn;
    autoTag: UseAutoTagReturn;
}

export function useAIFeatures(): UseAIFeaturesReturn {
    const summarize = useSummarize();
    const autoTag = useAutoTag();

    return { summarize, autoTag };
}
