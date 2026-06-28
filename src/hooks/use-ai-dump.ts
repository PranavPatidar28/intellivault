/**
 * AI Dump React Hook
 *
 * Provides state management and API interactions for the AI Dump feature.
 */

"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type {
    AIDumpOptions,
    TitleVariant,
    TagWithConfidence,
    ActionItem,
} from "@/lib/validations/ai-dump";

// ============================================================================
// Types
// ============================================================================

export interface AIDumpData {
    noteId: string;
    titles: TitleVariant[];
    tags: TagWithConfidence[];
    tldr: string;
    summary: string;
    markdown: string;
    actions: ActionItem[];
    rawText: string;
    status: "draft" | "final";
    /** Streamed model reasoning ("thinking"), separate from the answer. */
    reasoning?: string;
}

type SectionType = "titles" | "tags" | "markdown" | "actions";

interface RegenerateOptions {
    temperature?: number;
    tone?: "balanced" | "formal" | "casual" | "technical";
    /** Free-form refinement instruction (markdown section only). */
    instruction?: string;
}

interface CreateAIDumpExtras {
    /** base64 data-URL of an uploaded image, for multimodal processing. */
    imageData?: string;
    /** Origin of the content, for provenance. */
    source?: "webclipper" | "upload" | "clipboard" | "paste";
}

/** Summary row for the drafts list (GET /api/ai-dump). */
export interface DraftSummary {
    id: string;
    title: string;
    tldr: string | null;
    source: string | null;
    createdAt: string;
    updatedAt: string;
}

interface FinalizeOptions {
    selectedTitle: string;
    selectedTags: string[];
    finalMarkdown: string;
    retainRaw?: boolean;
}

interface UseAIDumpReturn {
    // State
    aiDump: AIDumpData | null;
    isProcessing: boolean;
    isRegenerating: Record<SectionType, boolean>;
    error: string | null;
    streamingStatus: string | null;
    /** Non-fatal warning surfaced during processing (e.g. content truncated). */
    warning: string | null;

    // Selected values for finalization
    selectedTitle: string;
    selectedTags: string[];

    // Actions
    createAIDump: (
        content: string,
        options?: Partial<AIDumpOptions>,
        extras?: CreateAIDumpExtras
    ) => Promise<boolean>;
    regenerateSection: (
        section: SectionType,
        options?: RegenerateOptions
    ) => Promise<boolean>;
    finalize: (options?: Partial<FinalizeOptions>) => Promise<string | null>;
    loadDraft: (noteId: string) => Promise<boolean>;
    deleteDraft: (noteId: string) => Promise<boolean>;
    listDrafts: () => Promise<DraftSummary[]>;

    // Selection handlers
    setSelectedTitle: (title: string) => void;
    toggleTag: (tag: string) => void;
    setSelectedTags: (tags: string[]) => void;

    // Utilities
    reset: () => void;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: AIDumpOptions = {
    template: "auto",
    toggles: {
        titles: true,
        tags: true,
        markdown: true,
        actions: false, // Disabled by default
        preserveCode: true,
    },
    tone: "balanced",
    temperature: 0.2,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAIDump(): UseAIDumpReturn {
    const { toast } = useToast();

    // State
    const [aiDump, setAIDump] = useState<AIDumpData | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState<
        Record<SectionType, boolean>
    >({
        titles: false,
        tags: false,
        markdown: false,
        actions: false,
    });
    const [error, setError] = useState<string | null>(null);
    const [selectedTitle, setSelectedTitle] = useState<string>("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    /**
     * Create a new AI Dump from content with streaming
     */
    const createAIDump = useCallback(
        async (
            content: string,
            options?: Partial<AIDumpOptions>,
            extras?: CreateAIDumpExtras
        ): Promise<boolean> => {
            setIsProcessing(true);
            setError(null);
            setWarning(null);
            setStreamingStatus("Connecting...");

            // Initialize partial state for progressive updates
            let noteId = "";
            let titles: TitleVariant[] = [];
            let tags: TagWithConfidence[] = [];
            let tldr = "";
            let summary = "";
            let markdown = "";
            let actions: ActionItem[] = [];
            let reasoning = "";

            try {
                const response = await fetch("/api/ai-dump/stream", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content,
                        source: extras?.source ?? "paste",
                        imageData: extras?.imageData,
                        options: { ...DEFAULT_OPTIONS, ...options },
                    }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to process content");
                }

                const reader = response.body?.getReader();
                if (!reader) throw new Error("No response body");

                const decoder = new TextDecoder();
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

                        try {
                            const event = JSON.parse(jsonStr);

                            switch (event.type) {
                                case "status":
                                    setStreamingStatus(event.data);
                                    break;
                                case "titles":
                                    titles = event.data;
                                    // Update state progressively
                                    setAIDump((prev) => ({
                                        ...(prev || {
                                            noteId: "",
                                            titles: [],
                                            tags: [],
                                            tldr: "",
                                            summary: "",
                                            markdown: "",
                                            actions: [],
                                            rawText: content,
                                            status: "draft" as const,
                                        }),
                                        titles: event.data,
                                    }));
                                    // Set default title
                                    const firstTitle = event.data.find((t: TitleVariant) => t.variant === "short")?.text || event.data[0]?.text || "";
                                    setSelectedTitle(firstTitle);
                                    break;
                                case "tags":
                                    tags = event.data;
                                    setAIDump((prev) => prev ? { ...prev, tags: event.data } : null);
                                    setSelectedTags(event.data.map((t: TagWithConfidence) => t.name));
                                    break;
                                case "tldr":
                                    tldr = event.data;
                                    setAIDump((prev) => prev ? { ...prev, tldr: event.data } : null);
                                    break;
                                case "markdown_chunk":
                                    markdown += event.data;
                                    setAIDump((prev) => prev ? { ...prev, markdown } : null);
                                    break;
                                case "markdown_end":
                                    markdown = event.data;
                                    setAIDump((prev) => prev ? { ...prev, markdown } : null);
                                    break;
                                case "summary_chunk":
                                    summary += event.data;
                                    setAIDump((prev) => prev ? { ...prev, summary } : null);
                                    break;
                                case "summary_end":
                                    summary = event.data;
                                    setAIDump((prev) => prev ? { ...prev, summary } : null);
                                    break;
                                case "actions":
                                    actions = event.data;
                                    setAIDump((prev) => prev ? { ...prev, actions: event.data } : null);
                                    break;
                                case "reasoning":
                                    reasoning += event.data;
                                    setAIDump((prev) => prev ? { ...prev, reasoning } : null);
                                    break;
                                case "note_created":
                                    noteId = event.data?.noteId ?? "";
                                    setAIDump((prev) => prev ? { ...prev, noteId } : null);
                                    break;
                                case "warning":
                                    setWarning(typeof event.data === "string" ? event.data : null);
                                    break;
                                case "error":
                                    throw new Error(event.data);
                                case "done":
                                    setStreamingStatus(null);
                                    break;
                            }
                        } catch (e) {
                            if (e instanceof SyntaxError) continue; // Skip malformed JSON
                            throw e;
                        }
                    }
                }

                // Final state update
                setAIDump({
                    noteId,
                    titles,
                    tags,
                    tldr,
                    summary,
                    markdown,
                    actions,
                    rawText: content,
                    status: "draft",
                    reasoning: reasoning || undefined,
                });

                toast({
                    title: "AI Dump Complete",
                    description: "Your content has been processed successfully.",
                });

                return true;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "An error occurred";
                setError(message);
                setStreamingStatus(null);
                toast({
                    title: "Processing Failed",
                    description: message,
                    variant: "destructive",
                });
                return false;
            } finally {
                setIsProcessing(false);
                setStreamingStatus(null);
            }
        },
        [toast]
    );

    /**
     * Regenerate a specific section
     */
    const regenerateSection = useCallback(
        async (
            section: SectionType,
            options?: RegenerateOptions
        ): Promise<boolean> => {
            if (!aiDump) {
                setError("No AI Dump to regenerate");
                return false;
            }
            if (!aiDump.noteId) {
                const msg =
                    "This draft wasn't saved on the server yet, so it can't be regenerated. Try running the AI Dump again.";
                setError(msg);
                toast({
                    title: "Cannot regenerate",
                    description: msg,
                    variant: "destructive",
                });
                return false;
            }

            setIsRegenerating((prev) => ({ ...prev, [section]: true }));
            setError(null);

            const { instruction, ...regenOptions } = options ?? {};

            try {
                const response = await fetch(
                    `/api/ai-dump/${aiDump.noteId}/regenerate`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            section,
                            instruction,
                            options: regenOptions,
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to regenerate section");
                }

                // Update the specific section
                setAIDump((prev) => {
                    if (!prev) return null;

                    const updated = { ...prev };
                    if (data.updatedSection.titles) {
                        updated.titles = data.updatedSection.titles;
                    }
                    if (data.updatedSection.tags) {
                        updated.tags = data.updatedSection.tags;
                        // Only reset the user's tag selection when tags were the
                        // section actually regenerated.
                        if (section === "tags") {
                            setSelectedTags(
                                data.updatedSection.tags.map((t: TagWithConfidence) => t.name)
                            );
                        }
                    }
                    if (data.updatedSection.markdown) {
                        updated.markdown = data.updatedSection.markdown;
                    }
                    if (data.updatedSection.actions) {
                        updated.actions = data.updatedSection.actions;
                    }

                    return updated;
                });

                toast({
                    title: "Section Regenerated",
                    description: `${section.charAt(0).toUpperCase() + section.slice(1)} have been updated.`,
                });

                return true;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "An error occurred";
                setError(message);
                toast({
                    title: "Regeneration Failed",
                    description: message,
                    variant: "destructive",
                });
                return false;
            } finally {
                setIsRegenerating((prev) => ({ ...prev, [section]: false }));
            }
        },
        [aiDump, toast]
    );

    /**
     * Finalize the AI Dump as a saved note
     */
    const finalize = useCallback(
        async (options?: Partial<FinalizeOptions>): Promise<string | null> => {
            if (!aiDump) {
                setError("No AI Dump to finalize");
                return null;
            }
            if (!aiDump.noteId) {
                const msg =
                    "This draft wasn't saved on the server yet, so it can't be finalized. Try running the AI Dump again.";
                setError(msg);
                toast({
                    title: "Cannot save note",
                    description: msg,
                    variant: "destructive",
                });
                return null;
            }

            setIsProcessing(true);
            setError(null);

            try {
                const response = await fetch(
                    `/api/ai-dump/${aiDump.noteId}/finalize`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            selectedTitle: options?.selectedTitle || selectedTitle,
                            selectedTags: options?.selectedTags || selectedTags,
                            finalMarkdown: options?.finalMarkdown || aiDump.markdown,
                            retainRaw: options?.retainRaw ?? true,
                        }),
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to save note");
                }

                setAIDump((prev) => (prev ? { ...prev, status: "final" } : null));

                toast({
                    title: "Note Saved",
                    description: "Your note has been saved successfully.",
                });

                return data.noteId;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "An error occurred";
                setError(message);
                toast({
                    title: "Save Failed",
                    description: message,
                    variant: "destructive",
                });
                return null;
            } finally {
                setIsProcessing(false);
            }
        },
        [aiDump, selectedTitle, selectedTags, toast]
    );

    /**
     * Load an existing draft
     */
    const loadDraft = useCallback(
        async (noteId: string): Promise<boolean> => {
            setIsProcessing(true);
            setError(null);

            try {
                const response = await fetch(`/api/ai-dump/${noteId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Failed to load draft");
                }

                const note = data.note;

                const loadedTitles: TitleVariant[] = note.titles || [];
                const loadedTags: TagWithConfidence[] =
                    note.tags?.map((t: { name: string }) => ({
                        name: t.name,
                        confidence: 1,
                    })) || [];

                setAIDump({
                    noteId: note.id,
                    titles: loadedTitles,
                    tags: loadedTags,
                    tldr: note.tldr || "",
                    summary: note.summary || "",
                    markdown: note.generatedMd || "",
                    actions: note.actions || [],
                    rawText: note.rawText || "",
                    status: note.status === "FINAL" ? "final" : "draft",
                });

                // Restore selections so the resumed draft shows its title/tags
                // instead of defaulting to "Untitled" with nothing selected.
                setSelectedTitle(
                    note.title ||
                        loadedTitles.find((t) => t.variant === "short")?.text ||
                        loadedTitles[0]?.text ||
                        ""
                );
                setSelectedTags(loadedTags.map((t) => t.name));

                return true;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "An error occurred";
                setError(message);
                return false;
            } finally {
                setIsProcessing(false);
            }
        },
        []
    );

    /**
     * Delete a draft
     */
    const deleteDraft = useCallback(
        async (noteId: string): Promise<boolean> => {
            try {
                const response = await fetch(`/api/ai-dump/${noteId}`, {
                    method: "DELETE",
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to delete draft");
                }

                if (aiDump?.noteId === noteId) {
                    setAIDump(null);
                }

                toast({
                    title: "Draft Deleted",
                    description: "The draft has been removed.",
                });

                return true;
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "An error occurred";
                toast({
                    title: "Delete Failed",
                    description: message,
                    variant: "destructive",
                });
                return false;
            }
        },
        [aiDump, toast]
    );

    /**
     * List the user's saved drafts (most recent first).
     */
    const listDrafts = useCallback(async (): Promise<DraftSummary[]> => {
        try {
            const response = await fetch("/api/ai-dump?limit=20");
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to load drafts");
            }
            return (data.notes as DraftSummary[]) ?? [];
        } catch (err) {
            console.error("Failed to list drafts:", err);
            return [];
        }
    }, []);

    /**
     * Toggle a tag selection
     */
    const toggleTag = useCallback((tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag)
                ? prev.filter((t) => t !== tag)
                : [...prev, tag]
        );
    }, []);

    /**
     * Reset all state
     */
    const reset = useCallback(() => {
        setAIDump(null);
        setIsProcessing(false);
        setIsRegenerating({
            titles: false,
            tags: false,
            markdown: false,
            actions: false,
        });
        setError(null);
        setWarning(null);
        setSelectedTitle("");
        setSelectedTags([]);
    }, []);

    return {
        aiDump,
        isProcessing,
        isRegenerating,
        error,
        streamingStatus,
        warning,
        selectedTitle,
        selectedTags,
        createAIDump,
        regenerateSection,
        finalize,
        loadDraft,
        deleteDraft,
        listDrafts,
        setSelectedTitle,
        toggleTag,
        setSelectedTags,
        reset,
    };
}
