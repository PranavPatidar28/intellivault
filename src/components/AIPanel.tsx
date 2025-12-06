"use client";

import { useState, useEffect } from "react";
import {
    Sparkles,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Lightbulb,
    Check,
    X,
    Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSummarize, useAutoTag, type TagSuggestion } from "@/hooks/use-ai-features";
import type { Tag } from "@/components/TagInput";

// ============================================================================
// Types
// ============================================================================

interface AIPanelProps {
    noteId: string;
    currentTags: Tag[];
    onApplyTags: (tagNames: string[]) => void;
    className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AIPanel({
    noteId,
    currentTags,
    onApplyTags,
    className,
}: AIPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
    const [hasLoadedSummary, setHasLoadedSummary] = useState(false);

    const { summarize, isLoading: isSummarizing } = useSummarize();
    const { suggestTags, isLoading: isSuggestingTags } = useAutoTag();

    // Load collapsed state from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("ai-panel-collapsed");
        if (stored) {
            setIsCollapsed(stored === "true");
        }
    }, []);

    // Save collapsed state
    const toggleCollapsed = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem("ai-panel-collapsed", String(newState));
    };

    const handleGenerateSummary = async () => {
        const result = await summarize(noteId, { length: "medium" });
        if (result) {
            setSummary(result.summary);
            setHasLoadedSummary(true);
        }
    };

    const handleSuggestTags = async () => {
        const result = await suggestTags(noteId);
        if (result) {
            // Filter out tags that are already applied
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

    const isLoading = isSummarizing || isSuggestingTags;
    const hasContent = summary || suggestions.length > 0;

    return (
        <div
            className={cn(
                "border-b bg-muted/30 transition-all duration-200",
                isCollapsed && "py-1",
                className
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2">
                <button
                    onClick={toggleCollapsed}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Sparkles size={14} className="text-primary" />
                    <span>AI Assistant</span>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>

                {!isCollapsed && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateSummary}
                            disabled={isLoading}
                            className="h-7 text-xs"
                        >
                            {isSummarizing ? (
                                <Loader2 size={12} className="mr-1 animate-spin" />
                            ) : (
                                <RefreshCw size={12} className="mr-1" />
                            )}
                            {hasLoadedSummary ? "Regenerate" : "Summarize"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSuggestTags}
                            disabled={isLoading}
                            className="h-7 text-xs"
                        >
                            {isSuggestingTags ? (
                                <Loader2 size={12} className="mr-1 animate-spin" />
                            ) : (
                                <Lightbulb size={12} className="mr-1" />
                            )}
                            Suggest Tags
                        </Button>
                    </div>
                )}
            </div>

            {/* Content */}
            {!isCollapsed && (
                <div className="px-4 pb-3 space-y-3">
                    {/* Summary Section */}
                    {summary && (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Summary
                            </div>
                            <p className="text-sm text-foreground/90 leading-relaxed bg-background/50 rounded-md p-3 border">
                                {summary}
                            </p>
                        </div>
                    )}

                    {/* Tag Suggestions Section */}
                    {suggestions.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Suggested Tags
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleApplyAllTags}
                                    className="h-6 text-xs text-primary hover:text-primary"
                                >
                                    <Check size={10} className="mr-1" />
                                    Apply All
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {suggestions.map((suggestion) => (
                                    <div
                                        key={suggestion.name}
                                        className="flex items-center gap-1 bg-background/50 rounded-full pl-3 pr-1 py-1 border"
                                    >
                                        <span className="text-sm">{suggestion.name}</span>
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0 h-4 ml-1"
                                        >
                                            {Math.round(suggestion.confidence * 100)}%
                                        </Badge>
                                        <button
                                            onClick={() => handleApplyTag(suggestion.name)}
                                            className="p-1 hover:bg-green-500/20 rounded-full transition-colors"
                                            title="Apply tag"
                                        >
                                            <Check size={12} className="text-green-600" />
                                        </button>
                                        <button
                                            onClick={() => handleDismissTag(suggestion.name)}
                                            className="p-1 hover:bg-red-500/20 rounded-full transition-colors"
                                            title="Dismiss"
                                        >
                                            <X size={12} className="text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!hasContent && !isLoading && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            Click &quot;Summarize&quot; or &quot;Suggest Tags&quot; to get AI-powered insights
                        </p>
                    )}

                    {/* Loading State */}
                    {isLoading && !hasContent && (
                        <div className="flex items-center justify-center gap-2 py-3">
                            <Loader2 size={16} className="animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">
                                {isSummarizing ? "Generating summary..." : "Finding tags..."}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
