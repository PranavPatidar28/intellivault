"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Search, Grid3x3, List, Trash2, Palette, GitMerge, TagsIcon } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TAG_COLOR_PALETTE } from "@/lib/utils/tagColors";

interface Tag {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    usageCount: number;
    lastUsed: Date;
    createdAt: Date;
    deletedAt: Date | null;
}

interface TagListProps {
    tags: Tag[];
    selectedTag: Tag | null;
    selectedTagIds: string[];
    onTagSelect: (tag: Tag) => void;
    onTagsSelectionChange: (tagIds: string[]) => void;
    onSearch: (query: string) => void;
    onSortChange: (sort: string, order: string) => void;
    onBulkDelete: () => void;
    onBulkRecolor: (color: string) => void;
    onMerge: () => void;
    viewMode: "list" | "grid";
    onViewModeChange: (mode: "list" | "grid") => void;
}

export function TagList({
    tags,
    selectedTag,
    selectedTagIds,
    onTagSelect,
    onTagsSelectionChange,
    onSearch,
    onSortChange,
    onBulkDelete,
    onBulkRecolor,
    onMerge,
    viewMode,
    onViewModeChange,
}: TagListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("usageCount");
    const [sortOrder, setSortOrder] = useState("desc");
    const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);
    const parentRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Virtualizer setup
    const rowVirtualizer = useVirtualizer({
        count: viewMode === "list" ? tags.length : Math.ceil(tags.length / 2),
        getScrollElement: () => parentRef.current,
        estimateSize: () => viewMode === "list" ? 60 : 120,
        overscan: 5,
    });

    // Listen for Ctrl+F to focus search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        onSearch(value);
    };

    const handleSortChange = (value: string) => {
        setSortBy(value);
        onSortChange(value, sortOrder);
    };

    const handleOrderChange = (value: string) => {
        setSortOrder(value);
        onSortChange(sortBy, value);
    };

    const toggleTagSelection = (tagId: string) => {
        if (selectedTagIds.includes(tagId)) {
            onTagsSelectionChange(selectedTagIds.filter((id) => id !== tagId));
        } else {
            onTagsSelectionChange([...selectedTagIds, tagId]);
        }
    };

    const selectAll = () => {
        onTagsSelectionChange(tags.map((t) => t.id));
    };

    const deselectAll = () => {
        onTagsSelectionChange([]);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="p-4 border-b space-y-3">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search tags..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Sort and View Mode */}
                <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={handleSortChange}>
                        <SelectTrigger className="flex-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="usageCount">Usage</SelectItem>
                            <SelectItem value="lastUsed">Last Used</SelectItem>
                            <SelectItem value="createdAt">Created</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={sortOrder} onValueChange={handleOrderChange}>
                        <SelectTrigger className="w-24">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="asc">Asc</SelectItem>
                            <SelectItem value="desc">Desc</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex gap-1 ml-auto">
                        <Button
                            variant={viewMode === "list" ? "default" : "outline"}
                            size="icon"
                            onClick={() => onViewModeChange("list")}
                            aria-label="List view"
                            aria-pressed={viewMode === "list"}
                        >
                            <List size={16} />
                        </Button>
                        <Button
                            variant={viewMode === "grid" ? "default" : "outline"}
                            size="icon"
                            onClick={() => onViewModeChange("grid")}
                            aria-label="Grid view"
                            aria-pressed={viewMode === "grid"}
                        >
                            <Grid3x3 size={16} />
                        </Button>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedTagIds.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <span className="text-xs sm:text-sm font-medium">{selectedTagIds.length} <span className="hidden xs:inline">selected</span><span className="xs:hidden">sel.</span></span>
                        <Button size="sm" variant="outline" onClick={deselectAll} className="h-8 px-2 text-xs">
                            Clear
                        </Button>
                        <Button size="sm" variant="outline" onClick={selectAll} className="h-8 px-2 text-xs">
                            All
                        </Button>
                        <div className="flex-1" />
                        <Button size="sm" variant="outline" onClick={onMerge} className="h-8 w-8 sm:w-auto p-0 sm:px-3 justify-center" title="Merge Tags">
                            <GitMerge size={14} className="sm:mr-1" />
                            <span className="hidden sm:inline">Merge</span>
                        </Button>
                        <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 w-8 sm:w-auto p-0 sm:px-3 justify-center" title="Recolor Tags">
                                    <Palette size={14} className="sm:mr-1" />
                                    <span className="hidden sm:inline">Color</span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="start">
                                <p className="text-sm font-medium mb-2">
                                    Recolor {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? "s" : ""}
                                </p>
                                <div className="grid grid-cols-5 gap-2">
                                    {TAG_COLOR_PALETTE.map((color) => (
                                        <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => {
                                                onBulkRecolor(color.value);
                                                setIsColorPopoverOpen(false);
                                            }}
                                            className="w-8 h-8 rounded-md border-2 border-transparent hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
                                            style={{ backgroundColor: color.value }}
                                            title={color.name}
                                            aria-label={`Recolor selected tags ${color.name}`}
                                        />
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button size="sm" variant="destructive" onClick={onBulkDelete} className="h-8 w-8 sm:w-auto p-0 sm:px-3 justify-center" title="Delete Tags">
                            <Trash2 size={14} className="sm:mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                        </Button>
                    </div>
                )}
            </div>

            {/* Tag List with Virtual Scrolling */}
            <div
                ref={parentRef}
                className="flex-1 overflow-y-auto p-4"
            >
                {tags.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 text-muted-foreground">
                        <TagsIcon className="h-10 w-10 mb-3 opacity-50" />
                        {searchQuery.trim() ? (
                            <>
                                <p className="text-sm font-medium text-foreground">No tags found</p>
                                <p className="text-sm mt-1">
                                    No tags match &ldquo;{searchQuery.trim()}&rdquo;. Try a different search.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-medium text-foreground">No tags yet</p>
                                <p className="text-sm mt-1">
                                    Tags are created when you add them to notes. Open a note and start
                                    tagging to see them here.
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        // For grid view, we render 2 items per row
                        if (viewMode === "grid") {
                            const startIndex = virtualRow.index * 2;
                            const rowTags = tags.slice(startIndex, startIndex + 2);

                            return (
                                <div
                                    key={virtualRow.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                    className="grid grid-cols-2 gap-3 pb-3"
                                >
                                    {rowTags.map((tag) => (
                                        <div
                                            key={tag.id}
                                            className={`group flex flex-col gap-2 p-4 rounded-xl border cursor-pointer transition-all ${selectedTag?.id === tag.id
                                                ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                                                : "hover:border-ring/40 hover:bg-accent/40 hover:shadow-sm"
                                                }`}
                                            onClick={() => onTagSelect(tag)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <span
                                                    className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                                    style={{ backgroundColor: tag.color || "var(--muted-foreground)" }}
                                                    aria-hidden="true"
                                                />
                                                <Checkbox
                                                    checked={selectedTagIds.includes(tag.id)}
                                                    onCheckedChange={() => toggleTagSelection(tag.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <span className="truncate font-medium">{tag.name}</span>
                                            <span className="text-sm text-muted-foreground tabular-nums">
                                                {tag.usageCount} note{tag.usageCount !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        // List view
                        const tag = tags[virtualRow.index];
                        return (
                            <div
                                key={tag.id}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className="pb-2"
                            >
                                <div
                                    className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedTag?.id === tag.id
                                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                                        : "hover:border-ring/40 hover:bg-accent/40 hover:shadow-sm"
                                        }`}
                                    onClick={() => onTagSelect(tag)}
                                >
                                    <Checkbox
                                        checked={selectedTagIds.includes(tag.id)}
                                        onCheckedChange={() => toggleTagSelection(tag.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <span
                                        className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                                        style={{ backgroundColor: tag.color || "var(--muted-foreground)" }}
                                        aria-hidden="true"
                                    />
                                    <span className="truncate font-medium">{tag.name}</span>
                                    <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                                        {tag.usageCount} note{tag.usageCount !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                )}
            </div>
        </div>
    );
}
