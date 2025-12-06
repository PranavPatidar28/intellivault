"use client";

import { useState, useEffect } from "react";
import {
    Sparkles,
    RefreshCw,
    Lightbulb,
    Check,
    X,
    Loader2,
    FileText,
    Wand2,
    PanelRightClose,
    Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSummarize, useAutoTag, type TagSuggestion, type SummarizeOptions } from "@/hooks/use-ai-features";
import { useRelatedNotes } from "@/hooks/use-related-notes";
import type { Tag } from "@/components/TagInput";

// ============================================================================
// Types
// ============================================================================

interface AISidebarProps {
    noteId: string;
    currentTags: Tag[];
    onApplyTags: (tagNames: string[]) => void;
    onApplyTitle?: (title: string) => void;
    isOpen: boolean;
    onToggle: () => void;
    className?: string;
    content: string;
    initialSummary?: string | null;
    initialGeneratedTitle?: string | null;
}

type SummaryLength = "short" | "medium" | "long";
type SummaryStyle = "bullet" | "paragraph" | "tldr";

// ============================================================================
// Summary Content Component with Markdown-like Rendering
// ============================================================================

interface SummaryContentProps {
    content: string;
    isStreaming?: boolean;
}

function SummaryContent({ content, isStreaming }: SummaryContentProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Parse markdown-like syntax into JSX
    const renderContent = () => {
        const lines = content.split("\n");
        const elements: React.ReactNode[] = [];
        let listItems: string[] = [];
        let listType: "ul" | "ol" | null = null;
        let listCount = 0;

        const flushList = () => {
            if (listItems.length > 0 && listType) {
                const ListTag = listType;
                const currentListKey = `list-${listCount++}`;
                elements.push(
                    <ListTag key={currentListKey} className={listType === "ul" ? "list-disc pl-4 space-y-1" : "list-decimal pl-4 space-y-1"}>
                        {listItems.map((item, i) => (
                            <li key={`${currentListKey}-item-${i}`}>{formatInline(item)}</li>
                        ))}
                    </ListTag>
                );
                listItems = [];
                listType = null;
            }
        };

        // Format inline text (bold, italic)
        const formatInline = (text: string): React.ReactNode => {
            // Handle **bold** and *italic*
            const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
            return parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={`bold-${i}`}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith("*") && part.endsWith("*")) {
                    return <em key={`italic-${i}`}>{part.slice(1, -1)}</em>;
                }
                return part;
            });
        };

        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Bullet points: - or •
            if (/^[-•]\s+/.test(trimmed)) {
                if (listType !== "ul") flushList();
                listType = "ul";
                listItems.push(trimmed.replace(/^[-•]\s+/, ""));
                return;
            }

            // Numbered lists: 1. 2. etc
            if (/^\d+\.\s+/.test(trimmed)) {
                if (listType !== "ol") flushList();
                listType = "ol";
                listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
                return;
            }

            // Regular paragraph
            flushList();
            if (trimmed) {
                elements.push(
                    <p key={`para-${index}`} className="mb-2 last:mb-0">
                        {formatInline(trimmed)}
                    </p>
                );
            }
        });

        flushList();
        return elements;
    };

    return (
        <div className="relative group">
            <div className="bg-background rounded-lg p-3 border text-xs leading-relaxed max-h-[350px] overflow-y-auto prose prose-sm dark:prose-invert prose-p:my-1 prose-li:my-0">
                {renderContent()}
                {isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
                )}
            </div>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded bg-muted/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                title="Copy summary"
            >
                {copied ? (
                    <Check size={12} className="text-green-500" />
                ) : (
                    <Copy size={12} className="text-muted-foreground" />
                )}
            </button>
        </div>
    );
}

// ============================================================================
// Sidebar Content Component
// ============================================================================

export function AISidebar({
    noteId,
    currentTags,
    onApplyTags,
    onApplyTitle,
    isOpen,
    onToggle,
    className,
    content,
    initialSummary,
    initialGeneratedTitle,
}: AISidebarProps) {
    const [summary, setSummary] = useState<string | null>(initialSummary || null);
    const [generatedTitle, setGeneratedTitle] = useState<string | null>(initialGeneratedTitle || null);
    const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
    const [hasLoadedSummary, setHasLoadedSummary] = useState(!!initialSummary);

    // Settings
    const [summaryLength, setSummaryLength] = useState<SummaryLength>("medium");
    const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>("paragraph");

    const { summarizeStream, generateTitle, isLoading: isSummarizing } = useSummarize();
    const { suggestTags, isLoading: isSuggestingTags } = useAutoTag();
    const { findRelated, relatedNotes, isLoading: isFindingRelated } = useRelatedNotes();

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            // Ctrl+Shift+S -> Summarize
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "S") {
                e.preventDefault();
                handleGenerateSummary();
            }
            // Ctrl+Shift+T -> Suggest Tags
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
                e.preventDefault();
                handleSuggestTags();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    // Auto-find related notes when sidebar opens
    useEffect(() => {
        if (isOpen && noteId) {
            // We need content to search. For now, let's just trigger it if user clicks.
            // Or we could pass content in props if we want auto-search.
            // Let's stick to manual trigger for now to avoid prop drilling large content.
        }
    }, [isOpen, noteId]);

    const handleGenerateSummary = async () => {
        // Clear previous summary to show streaming fresh
        setSummary("");
        setGeneratedTitle(null);
        setHasLoadedSummary(true);

        const result = await summarizeStream(noteId, {
            length: summaryLength,
            style: summaryStyle,
            onChunk: (_chunk, accumulated) => {
                // Update summary state as chunks arrive
                setSummary(accumulated);
            },
        });

        // After streaming completes, also generate a title
        if (result) {
            const title = await generateTitle(noteId);
            if (title) {
                setGeneratedTitle(title);
            }
        }
    };

    const handleSuggestTags = async () => {
        const result = await suggestTags(noteId);
        if (result) {
            const currentTagNames = new Set(currentTags.map((t) => t.name.toLowerCase()));
            const newSuggestions = result.suggestions.filter(
                (s) => !currentTagNames.has(s.name.toLowerCase())
            );
            setSuggestions(newSuggestions);
        }
    };

    const handleApplyTag = (tagName: string) => {
        onApplyTags([tagName]);
        setSuggestions((prev) => prev.filter((s) => s.name !== tagName));
    };

    const handleDismissTag = (tagName: string) => {
        setSuggestions((prev) => prev.filter((s) => s.name !== tagName));
    };

    const handleApplyAllTags = () => {
        onApplyTags(suggestions.map((s) => s.name));
        setSuggestions([]);
    };

    const handleApplyTitle = () => {
        if (generatedTitle && onApplyTitle) {
            onApplyTitle(generatedTitle);
            setGeneratedTitle(null);
        }
    };

    const isLoading = isSummarizing || isSuggestingTags;

    // Render Sidebar
    return (
        <div
            className={cn(
                "border-l bg-muted/20 flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out",
                isOpen ? "w-[320px]" : "w-[50px]",
                className
            )}
        >
            {/* Header / Toggle Area */}
            <div className={cn(
                "flex items-center p-2 border-b bg-background/50 h-[45px]", // Fixed height to match likely tag bar height
                isOpen ? "justify-between px-3" : "justify-center"
            )}>
                {isOpen && (
                    <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                        <Sparkles size={16} className="text-primary" />
                        <h2 className="font-semibold text-sm">AI Assistant</h2>
                    </div>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className="h-8 w-8 shrink-0"
                    title={isOpen ? "Close AI Sidebar" : "Open AI Assistant"}
                >
                    {isOpen ? (
                        <PanelRightClose size={18} className="text-muted-foreground" />
                    ) : (
                        <Sparkles size={18} className="text-primary" />
                    )}
                </Button>
            </div>

            {/* Content */}
            <div className={cn(
                "flex-1 overflow-y-auto p-4 space-y-5",
                !isOpen && "hidden"
            )}>
                {/* Summary Section */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                            <FileText size={12} />
                            Summary
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateSummary}
                            disabled={isLoading}
                            className="h-6 text-[10px] px-2"
                        >
                            {isSummarizing ? (
                                <Loader2 size={10} className="mr-1 animate-spin" />
                            ) : (
                                <RefreshCw size={10} className="mr-1" />
                            )}
                            {hasLoadedSummary ? "Regenerate" : "Generate"}
                        </Button>
                    </div>

                    {/* Settings */}
                    <div className="flex gap-2">
                        <Select value={summaryLength} onValueChange={(v) => setSummaryLength(v as SummaryLength)}>
                            <SelectTrigger className="h-7 text-[10px] flex-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="short">Short</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="long">Long</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={summaryStyle} onValueChange={(v) => setSummaryStyle(v as SummaryStyle)}>
                            <SelectTrigger className="h-7 text-[10px] flex-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paragraph">Paragraph</SelectItem>
                                <SelectItem value="bullet">Bullets</SelectItem>
                                <SelectItem value="tldr">TL;DR</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Summary Content */}
                    {isSummarizing && !summary && (
                        <div className="flex items-center justify-center gap-2 py-4 bg-muted/30 rounded-lg">
                            <Loader2 size={14} className="animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">Generating...</span>
                        </div>
                    )}

                    {summary && (
                        <SummaryContent
                            content={summary}
                            isStreaming={isSummarizing}
                        />
                    )}

                    {!summary && !isSummarizing && (
                        <div className="text-center py-4 bg-muted/20 rounded-lg border-dashed border">
                            <p className="text-[10px] text-muted-foreground">Click Generate</p>
                        </div>
                    )}
                </section>

                {/* Generated Title Section */}
                {generatedTitle && (
                    <>
                        <Separator />
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                                <Wand2 size={12} />
                                Suggested Title
                            </h3>
                            <div className="flex items-center gap-2 bg-background rounded-lg p-2 border">
                                <span className="text-xs flex-1 truncate">{generatedTitle}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleApplyTitle}
                                    className="h-6 text-[10px] px-2 text-primary shrink-0"
                                >
                                    <Check size={10} className="mr-1" />
                                    Apply
                                </Button>
                            </div>
                        </section>
                    </>
                )}

                <Separator />

                {/* Related Notes Section */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                            <FileText size={12} />
                            Related Notes
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                findRelated(noteId, content);
                            }}
                            disabled={isFindingRelated}
                            className="h-6 text-[10px] px-2"
                        >
                            {isFindingRelated ? (
                                <Loader2 size={10} className="mr-1 animate-spin" />
                            ) : (
                                <RefreshCw size={10} className="mr-1" />
                            )}
                            Find
                        </Button>
                    </div>

                    {isFindingRelated && (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 size={14} className="animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!isFindingRelated && relatedNotes.length > 0 && (
                        <div className="space-y-2">
                            {relatedNotes.map((note) => (
                                <a
                                    key={note.id}
                                    href={`/notes/${note.id}`}
                                    className="block p-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                                >
                                    <div className="font-medium text-xs truncate">{note.title}</div>
                                    <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                                        {note.preview}
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}

                    {!isFindingRelated && relatedNotes.length === 0 && (
                        <div className="text-center py-4 bg-muted/20 rounded-lg border-dashed border">
                            <p className="text-[10px] text-muted-foreground">Click Find to see related notes</p>
                        </div>
                    )}
                </section>

                <Separator />

                {/* Tag Suggestions Section */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                            <Lightbulb size={12} />
                            Tags
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSuggestTags}
                            disabled={isLoading}
                            className="h-6 text-[10px] px-2"
                        >
                            {isSuggestingTags ? (
                                <Loader2 size={10} className="mr-1 animate-spin" />
                            ) : (
                                <Lightbulb size={10} className="mr-1" />
                            )}
                            Suggest
                        </Button>
                    </div>

                    {/* Loading State */}
                    {isSuggestingTags && suggestions.length === 0 && (
                        <div className="flex items-center justify-center gap-2 py-4 bg-muted/30 rounded-lg">
                            <Loader2 size={14} className="animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">Finding tags...</span>
                        </div>
                    )}

                    {/* Tag Suggestions */}
                    {suggestions.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-end">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleApplyAllTags}
                                    className="h-5 text-[10px] px-2 text-primary"
                                >
                                    <Check size={8} className="mr-1" />
                                    Apply All
                                </Button>
                            </div>
                            <div className="space-y-1.5">
                                {suggestions.map((suggestion) => (
                                    <div
                                        key={suggestion.name}
                                        className="flex items-center justify-between bg-background rounded-lg px-2.5 py-1.5 border"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-medium">{suggestion.name}</span>
                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                                                {Math.round(suggestion.confidence * 100)}%
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            <button
                                                onClick={() => handleApplyTag(suggestion.name)}
                                                className="p-1 hover:bg-green-500/20 rounded transition-colors"
                                                title="Apply"
                                            >
                                                <Check size={12} className="text-green-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDismissTag(suggestion.name)}
                                                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                                title="Dismiss"
                                            >
                                                <X size={12} className="text-muted-foreground" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {suggestions.length === 0 && !isSuggestingTags && (
                        <div className="text-center py-4 bg-muted/20 rounded-lg border-dashed border">
                            <p className="text-[10px] text-muted-foreground">Click Suggest</p>
                        </div>
                    )}
                </section>
            </div>

            {/* Footer */}
            {/* {isOpen && (
                <div className="p-3 border-t bg-background/50">
                    <p className="text-[9px] text-muted-foreground text-center">
                        Powered by AI • Results may vary
                    </p>
                </div>
            )} */}
        </div>
    );
}
