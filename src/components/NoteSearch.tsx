"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, FileText, Calendar, Hash } from "lucide-react";
import { useSemanticSearch } from "@/hooks/use-semantic-search";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getRelativeTime } from "@/lib/utils/text";

const LISTBOX_ID = "note-search-listbox";
const optionId = (index: number) => `note-search-option-${index}`;

export function NoteSearch() {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const { query, setQuery, results, isLoading, search, clear } = useSemanticSearch();
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Debounce search to avoid too many requests
    const debouncedSearch = useDebounce((q: string) => {
        search(q);
    }, 400);

    // Reset the active option whenever the result set changes
    React.useEffect(() => {
        setActiveIndex(-1);
    }, [results]);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);

        if (value.trim()) {
            setOpen(true);
            debouncedSearch(value);
        } else {
            setOpen(false);
            clear();
        }
    };

    const handleSelect = (noteId: string) => {
        setOpen(false);
        setActiveIndex(-1);
        setQuery("");
        clear();
        router.push(`/notes/${noteId}`);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
            inputRef.current?.blur();
            return;
        }

        if (!open || results.length === 0) {
            // Allow ArrowDown to reopen a populated dropdown
            if (e.key === "ArrowDown" && query.trim() && results.length > 0) {
                e.preventDefault();
                setOpen(true);
                setActiveIndex(0);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((prev) => (prev + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
        } else if (e.key === "Enter") {
            if (activeIndex >= 0 && activeIndex < results.length) {
                e.preventDefault();
                handleSelect(results[activeIndex].id);
            }
        } else if (e.key === "Home") {
            e.preventDefault();
            setActiveIndex(0);
        } else if (e.key === "End") {
            e.preventDefault();
            setActiveIndex(results.length - 1);
        }
    };

    // Keyboard shortcut to focus search
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const isExpanded = open && !!query.trim();

    return (
        <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-lg">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    type="search"
                    role="combobox"
                    aria-label="Search notes"
                    aria-expanded={isExpanded}
                    aria-controls={LISTBOX_ID}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        isExpanded && activeIndex >= 0 ? optionId(activeIndex) : undefined
                    }
                    placeholder="Search notes... (Cmd+K)"
                    className="pl-9 pr-4 w-full bg-background/50 border-muted-foreground/20 focus:bg-background transition-all"
                    value={query}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (query.trim()) setOpen(true);
                    }}
                />
                {isLoading && (
                    <div className="absolute right-2.5 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>

            {isExpanded && (
                <div className="absolute top-full left-0 right-0 mt-2 p-1 bg-popover text-popover-foreground rounded-lg border shadow-lg z-50 animate-in fade-in-0 zoom-in-95 overflow-hidden">
                    {results.length > 0 ? (
                        <div
                            id={LISTBOX_ID}
                            role="listbox"
                            aria-label="Search results"
                            className="max-h-[60vh] overflow-y-auto custom-scrollbar"
                        >
                            <div className="p-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Semantic Matches
                            </div>
                            {results.map((result, index) => (
                                <div
                                    key={`${result.id}-${result.chunkIndex}`}
                                    id={optionId(index)}
                                    role="option"
                                    aria-selected={index === activeIndex}
                                    onClick={() => handleSelect(result.id)}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    className={cn(
                                        "flex flex-col gap-1 p-3 rounded-md cursor-pointer transition-colors group",
                                        index === activeIndex
                                            ? "bg-muted"
                                            : "hover:bg-muted/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-medium text-sm text-foreground/90">
                                            <FileText size={14} className="text-primary/70" />
                                            <span className="truncate">{result.title}</span>
                                            {result.score > 0.75 && (
                                                <Badge variant="secondary" className="text-[10px] h-4 px-1 py-0 bg-green-500/10 text-green-600 border-green-500/20">
                                                    High Match
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <Calendar size={10} />
                                            {getRelativeTime(new Date(result.updatedAt))}
                                        </div>
                                    </div>

                                    {/* Preview with highlighting */}
                                    <p className="text-xs text-muted-foreground line-clamp-2 pl-6 border-l-2 border-transparent group-hover:border-primary/20 transition-colors">
                                        {highlightMatch(result.preview, query)}
                                    </p>

                                    {/* Tags */}
                                    {result.tags.length > 0 && (
                                        <div className="flex items-center gap-1.5 pl-6 mt-1 flex-wrap">
                                            <Hash size={10} className="text-muted-foreground/50" />
                                            {result.tags.slice(0, 3).map(tag => (
                                                <span key={tag.id} className="text-[10px] text-muted-foreground/70 bg-secondary/30 px-1 rounded-sm">
                                                    {tag.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : !isLoading ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            <div className="flex justify-center mb-2">
                                <Search className="h-8 w-8 opacity-20" />
                            </div>
                            No matching notes found.
                            <br />
                            <span className="text-xs opacity-70">Try describing what you&apos;re looking for.</span>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Overlay to close on click outside */}
            {open && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    aria-hidden="true"
                    onClick={() => setOpen(false)}
                />
            )}
        </div>
    );
}

// Escape regex metacharacters so user queries like "c++" or "foo(" don't
// produce an invalid pattern that throws during render.
function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Helper to highlight matching terms in preview
function highlightMatch(text: string, query: string) {
    if (!query || !text) return text;

    // Match whole-ish query words (length > 2) for highlights
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return text;

    let regex: RegExp;
    try {
        regex = new RegExp(`(${words.map(escapeRegExp).join("|")})`, "gi");
    } catch {
        // Defensive: if pattern construction still fails, render plain text
        return text;
    }

    const parts = text.split(regex);
    const lowered = words.map(w => w.toLowerCase());

    return (
        <span>
            {parts.map((part, i) => {
                const isMatch = lowered.includes(part.toLowerCase());
                return isMatch ? (
                    <span key={i} className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 font-medium rounded-sm px-0.5">
                        {part}
                    </span>
                ) : (
                    part
                );
            })}
        </span>
    );
}
