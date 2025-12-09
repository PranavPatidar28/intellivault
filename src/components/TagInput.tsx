"use client";

import { useState, KeyboardEvent, useEffect, useRef } from "react";
import { X, Plus, Loader2, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Tag {
    id: string;
    name: string;
    color?: string | null;
    usageCount?: number;
}

interface TagInputProps {
    value?: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    className?: string;
    showTags?: boolean;
    onAddTag?: (tag: Tag | string) => void;
    onRemoveTag?: (tag: string) => void;
    autoFocus?: boolean;
    maxTags?: number;
    disabled?: boolean;
}

export function TagInput({
    value = [],
    onChange,
    placeholder = "Add a tag...",
    className,
    showTags = true,
    onAddTag,
    onRemoveTag,
    autoFocus = false,
    maxTags,
    disabled = false,
}: TagInputProps) {
    const [inputValue, setInputValue] = useState("");
    const [suggestions, setSuggestions] = useState<Tag[]>([]);
    const [recentTags, setRecentTags] = useState<Tag[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [showCreateOption, setShowCreateOption] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [tagColors, setTagColors] = useState<Record<string, string>>({});
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const isAtMaxTags = maxTags !== undefined && value.length >= maxTags;

    // Fetch recent tags on mount
    useEffect(() => {
        fetch("/api/tags?limit=5&sort=recent")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setRecentTags(data.tags);
                    // Build color map
                    const colors: Record<string, string> = {};
                    data.tags.forEach((t: Tag) => {
                        if (t.color) colors[t.name] = t.color;
                    });
                    setTagColors((prev) => ({ ...prev, ...colors }));
                }
            })
            .catch((err) => console.error("Failed to fetch recent tags", err));
    }, []);

    // Fetch suggestions when input changes (debounced)
    useEffect(() => {
        if (inputValue.trim().length < 2) {
            setSuggestions([]);
            setShowCreateOption(false);
            return;
        }

        setIsLoading(true);
        const timer = setTimeout(() => {
            fetch(`/api/tags?q=${encodeURIComponent(inputValue)}&limit=5`)
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) {
                        setSuggestions(data.tags);
                        // Update color map
                        const colors: Record<string, string> = {};
                        data.tags.forEach((t: Tag) => {
                            if (t.color) colors[t.name] = t.color;
                        });
                        setTagColors((prev) => ({ ...prev, ...colors }));
                        // Show "Create new tag" option if no exact match
                        const exactMatch = data.tags.some(
                            (t: Tag) => t.name.toLowerCase() === inputValue.toLowerCase()
                        );
                        setShowCreateOption(!exactMatch && inputValue.trim().length > 0);
                    }
                })
                .catch((err) => console.error("Failed to fetch tags", err))
                .finally(() => setIsLoading(false));
        }, 300);

        return () => {
            clearTimeout(timer);
            setIsLoading(false);
        };
    }, [inputValue]);

    // Reset selected index when suggestions change
    useEffect(() => {
        setSelectedIndex(-1);
    }, [suggestions]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        // Handle comma and semicolon as delimiters
        if (e.key === "," || e.key === ";") {
            e.preventDefault();
            if (inputValue.trim()) {
                addTag(inputValue);
            }
            return;
        }

        const displayedTags = inputValue.trim().length >= 2 ? suggestions : recentTags.filter((t) => !value.includes(t.name));
        const totalOptions = displayedTags.length + (showCreateOption ? 1 : 0);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === "Enter" || e.key === "Tab") {
            if (totalOptions > 0 || inputValue.trim()) {
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < displayedTags.length) {
                    addTag(displayedTags[selectedIndex]);
                } else if (selectedIndex === displayedTags.length && showCreateOption) {
                    addTag(inputValue);
                } else if (inputValue.trim()) {
                    addTag(inputValue);
                }
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setSuggestions([]);
            setShowCreateOption(false);
            setSelectedIndex(-1);
            inputRef.current?.blur();
        } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
            const tagToRemove = value[value.length - 1];
            if (onRemoveTag) {
                onRemoveTag(tagToRemove);
            } else {
                removeTag(tagToRemove);
            }
        }
    };

    const addTag = (tag: string | Tag) => {
        if (isAtMaxTags) return;

        const tagName = typeof tag === "string" ? tag : tag.name;
        const trimmed = tagName.trim();

        if (trimmed && !value.includes(trimmed)) {
            if (onAddTag) {
                onAddTag(typeof tag === "string" ? trimmed : tag);
            } else {
                onChange([...value, trimmed]);
            }
            // Store color if available
            if (typeof tag !== "string" && tag.color) {
                setTagColors((prev) => ({ ...prev, [trimmed]: tag.color! }));
            }
            setInputValue("");
            setSuggestions([]);
            setShowCreateOption(false);
            setSelectedIndex(-1);
        }
    };

    const removeTag = (tagToRemove: string) => {
        if (onRemoveTag) {
            onRemoveTag(tagToRemove);
        } else {
            onChange(value.filter((tag) => tag !== tagToRemove));
        }
    };

    const handleContainerClick = () => {
        if (!disabled && inputRef.current) {
            inputRef.current.focus();
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        // Delay to allow click on suggestions
        setTimeout(() => {
            setIsFocused(false);
            setSuggestions([]);
            setShowCreateOption(false);
            setSelectedIndex(-1);
        }, 150);
    };

    // Determine what to show in dropdown
    const displayedTags = inputValue.trim().length >= 2
        ? suggestions
        : recentTags.filter((t) => !value.includes(t.name));

    const showDropdown = isFocused && (displayedTags.length > 0 || showCreateOption || isLoading);
    const showRecentHeader = inputValue.trim().length < 2 && displayedTags.length > 0;

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex flex-wrap gap-2 items-center cursor-text min-h-[32px]",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
            onClick={handleContainerClick}
        >
            {showTags && value.map((tag) => (
                <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1 shrink-0"
                    style={tagColors[tag] ? {
                        backgroundColor: `${tagColors[tag]}20`,
                        borderColor: tagColors[tag],
                        color: tagColors[tag],
                    } : undefined}
                >
                    {tagColors[tag] && (
                        <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: tagColors[tag] }}
                        />
                    )}
                    {tag}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            removeTag(tag);
                        }}
                        disabled={disabled}
                        className="hover:bg-muted p-0.5 rounded-full ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <X size={14} />
                        <span className="sr-only">Remove {tag}</span>
                    </button>
                </Badge>
            ))}

            {isAtMaxTags ? (
                <span className="text-xs text-muted-foreground">Max {maxTags} tags</span>
            ) : (
                <div className="relative flex-1 min-w-[120px]">
                    <Input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder={value.length === 0 ? placeholder : ""}
                        disabled={disabled}
                        className="h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 border-0 p-0 bg-transparent placeholder:text-muted-foreground"
                        autoFocus={autoFocus}
                    />

                    {showDropdown && (
                        <div className="absolute top-full left-0 z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-lg overflow-hidden">
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Searching...</span>
                                </div>
                            ) : displayedTags.length === 0 && inputValue.trim().length >= 2 && !showCreateOption ? (
                                <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                                    <TagIcon className="h-4 w-4" />
                                    <span>No matching tags</span>
                                </div>
                            ) : (
                                <>
                                    {showRecentHeader && (
                                        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                                            Recent tags
                                        </div>
                                    )}
                                    {displayedTags.map((suggestion, index) => (
                                        <button
                                            key={suggestion.id}
                                            type="button"
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2",
                                                selectedIndex === index && "bg-accent text-accent-foreground"
                                            )}
                                            onClick={() => addTag(suggestion)}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                {suggestion.color && (
                                                    <div
                                                        className="w-3 h-3 rounded-full border shrink-0"
                                                        style={{ backgroundColor: suggestion.color }}
                                                    />
                                                )}
                                                <span>{suggestion.name}</span>
                                            </div>
                                            {suggestion.usageCount !== undefined && (
                                                <span className="text-xs text-muted-foreground">
                                                    {suggestion.usageCount} notes
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                    {showCreateOption && (
                                        <button
                                            type="button"
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 border-t",
                                                selectedIndex === displayedTags.length && "bg-accent text-accent-foreground"
                                            )}
                                            onClick={() => addTag(inputValue)}
                                            onMouseEnter={() => setSelectedIndex(displayedTags.length)}
                                        >
                                            <Plus size={14} />
                                            <span>Create &quot;{inputValue}&quot;</span>
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
