"use client";

import { useState } from "react";
import { RefreshCw, Check, X, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
    TitleVariant,
    TagWithConfidence,
    ActionItem,
} from "@/lib/validations/ai-dump";

// ============================================================================
// Types
// ============================================================================

type SectionType = "titles" | "tags" | "markdown" | "actions";

interface AIDumpResultProps {
    titles: TitleVariant[];
    tags: TagWithConfidence[];
    tldr: string;
    summary: string;
    markdown: string;
    actions: ActionItem[];
    selectedTitle: string;
    selectedTags: string[];
    onSelectTitle: (title: string) => void;
    onToggleTag: (tag: string) => void;
    onRegenerate: (section: SectionType) => void;
    isRegenerating: Record<SectionType, boolean>;
}

// ============================================================================
// Main Component
// ============================================================================

export function AIDumpResult({
    titles,
    tags,
    tldr,
    summary,
    actions,
    selectedTitle,
    selectedTags,
    onSelectTitle,
    onToggleTag,
    onRegenerate,
    isRegenerating,
}: AIDumpResultProps) {
    return (
        <div className="space-y-4">
            {/* TL;DR */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        TL;DR
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{tldr}</p>
                </CardContent>
            </Card>

            {/* Titles Section */}
            <ResultSection
                title="Title Variants"
                section="titles"
                onRegenerate={onRegenerate}
                isRegenerating={isRegenerating.titles}
            >
                <div className="space-y-2">
                    {titles.map((title) => (
                        <TitleOption
                            key={title.variant}
                            title={title}
                            isSelected={selectedTitle === title.text}
                            onSelect={() => onSelectTitle(title.text)}
                        />
                    ))}
                </div>
            </ResultSection>

            {/* Tags Section */}
            <ResultSection
                title="Suggested Tags"
                section="tags"
                onRegenerate={onRegenerate}
                isRegenerating={isRegenerating.tags}
            >
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <TagOption
                            key={tag.name}
                            tag={tag}
                            isSelected={selectedTags.includes(tag.name)}
                            onToggle={() => onToggleTag(tag.name)}
                        />
                    ))}
                </div>
            </ResultSection>

            {/* Actions Section */}
            {actions.length > 0 && (
                <ResultSection
                    title="Action Items"
                    section="actions"
                    onRegenerate={onRegenerate}
                    isRegenerating={isRegenerating.actions}
                >
                    <div className="space-y-2">
                        {actions.map((action, idx) => (
                            <ActionItemRow key={idx} action={action} />
                        ))}
                    </div>
                </ResultSection>
            )}

            {/* Summary */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{summary}</p>
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ResultSectionProps {
    title: string;
    section: SectionType;
    onRegenerate: (section: SectionType) => void;
    isRegenerating: boolean;
    children: React.ReactNode;
}

function ResultSection({
    title,
    section,
    onRegenerate,
    isRegenerating,
    children,
}: ResultSectionProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                    >
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 transition-transform",
                                !isExpanded && "-rotate-90"
                            )}
                        />
                        {title}
                    </button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRegenerate(section)}
                        disabled={isRegenerating}
                        className="h-7 text-xs"
                    >
                        <RefreshCw
                            className={cn("h-3 w-3 mr-1", isRegenerating && "animate-spin")}
                        />
                        Regenerate
                    </Button>
                </div>
            </CardHeader>
            {isExpanded && <CardContent>{children}</CardContent>}
        </Card>
    );
}

interface TitleOptionProps {
    title: TitleVariant;
    isSelected: boolean;
    onSelect: () => void;
}

function TitleOption({ title, isSelected, onSelect }: TitleOptionProps) {
    const variantLabels: Record<TitleVariant["variant"], string> = {
        short: "Short",
        descriptive: "Descriptive",
        shareable: "Shareable",
    };

    return (
        <button
            onClick={onSelect}
            className={cn(
                "w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
                isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
            )}
        >
            <div
                className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5",
                    isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                )}
            >
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                        {variantLabels[title.variant]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                        {Math.round(title.score * 100)}% confidence
                    </span>
                </div>
                <p className="text-sm">{title.text}</p>
            </div>
        </button>
    );
}

interface TagOptionProps {
    tag: TagWithConfidence;
    isSelected: boolean;
    onToggle: () => void;
}

function TagOption({ tag, isSelected, onToggle }: TagOptionProps) {
    return (
        <button
            onClick={onToggle}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
            )}
        >
            {isSelected ? (
                <Check className="h-3 w-3" />
            ) : (
                <X className="h-3 w-3 opacity-50" />
            )}
            {tag.name}
            <span className="text-xs opacity-70">
                {Math.round(tag.confidence * 100)}%
            </span>
        </button>
    );
}

interface ActionItemRowProps {
    action: ActionItem;
}

function ActionItemRow({ action }: ActionItemRowProps) {
    return (
        <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
            <div className="w-4 h-4 mt-0.5 rounded border-2 border-muted-foreground/30 flex-shrink-0" />
            <div className="flex-1 min-w-0">
                <p className="text-sm">{action.text}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {action.assignee && (
                        <span className="flex items-center gap-1">
                            <span className="font-medium">@{action.assignee}</span>
                        </span>
                    )}
                    {action.due_date && (
                        <span className="flex items-center gap-1">
                            Due: {new Date(action.due_date).toLocaleDateString()}
                        </span>
                    )}
                    <span className="ml-auto">
                        {Math.round(action.confidence * 100)}% confidence
                    </span>
                </div>
            </div>
        </div>
    );
}
