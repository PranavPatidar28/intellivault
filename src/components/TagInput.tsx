"use client";

import { useState, KeyboardEvent, useEffect, useRef } from "react";
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
}: TagInputProps & {
    showTags?: boolean;
    onAddTag?: (tag: Tag | string) => void;
    onRemoveTag?: (tag: string) => void;
    autoFocus?: boolean;
}) {
    const [inputValue, setInputValue] = useState("");
    const [suggestions, setSuggestions] = useState<Tag[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [showCreateOption, setShowCreateOption] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch suggestions when input changes (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputValue.trim().length > 1) {
                fetch(`/api/tags?q=${encodeURIComponent(inputValue)}&limit=5`)
                    .then((res) => res.json())
                    .then((data) => {
                        if (data.success) {
                            setSuggestions(data.tags);
                            // Show "Create new tag" option if no exact match
                            const exactMatch = data.tags.some(
                                (t: Tag) => t.name.toLowerCase() === inputValue.toLowerCase()
                            );
                            setShowCreateOption(!exactMatch);
                        }
                    })
                    .catch((err) => console.error("Failed to fetch tags", err));
            } else {
                setSuggestions([]);
                setShowCreateOption(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [inputValue]);

    // Reset selected index when suggestions change
    useEffect(() => {
        setSelectedIndex(-1);
    }, [suggestions]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        const totalOptions = suggestions.length + (showCreateOption ? 1 : 0);

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                // Select from suggestions
                addTag(suggestions[selectedIndex]);
            } else if (selectedIndex === suggestions.length && showCreateOption) {
                // Create new tag
                addTag(inputValue);
            } else {
                // Add current input
                addTag(inputValue);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setSuggestions([]);
            setShowCreateOption(false);
            setSelectedIndex(-1);
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
        const tagName = typeof tag === "string" ? tag : tag.name;
        const trimmed = tagName.trim();

        if (trimmed && !value.includes(trimmed)) {
            if (onAddTag) {
                onAddTag(typeof tag === "string" ? trimmed : tag);
            } else {
                onChange([...value, trimmed]);
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

    return (
        <div className={cn("flex flex-wrap gap-2 items-center", className)}>
            {showTags && value.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:bg-muted p-0.5 rounded-full ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        <X size={14} />
                        <span className="sr-only">Remove {tag}</span>
                    </button>
                </Badge>
            ))}
            <div className="relative flex-1 min-w-[120px]">
                <Input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={value.length === 0 ? placeholder : ""}
                    className="h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 border-0 p-0 bg-transparent placeholder:text-muted-foreground"
                    autoFocus={autoFocus}
                />
                {(suggestions.length > 0 || showCreateOption) && (
                    <div className="absolute top-full left-0 z-10 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md overflow-hidden">
                        {suggestions.map((suggestion, index) => (
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
                                            className="w-3 h-3 rounded-full border"
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
                                    selectedIndex === suggestions.length && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => addTag(inputValue)}
                                onMouseEnter={() => setSelectedIndex(suggestions.length)}
                            >
                                <Plus size={14} />
                                <span>Create &quot;{inputValue}&quot;</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
