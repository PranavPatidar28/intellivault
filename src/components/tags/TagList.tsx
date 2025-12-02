"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, Grid3x3, List, Trash2, Palette, GitMerge } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

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
                        >
                            <List size={16} />
                        </Button>
                        <Button
                            variant={viewMode === "grid" ? "default" : "outline"}
                            size="icon"
                            onClick={() => onViewModeChange("grid")}
                        >
                            <Grid3x3 size={16} />
                        </Button>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedTagIds.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <span className="text-sm">{selectedTagIds.length} selected</span>
                        <Button size="sm" variant="outline" onClick={deselectAll}>
                            Clear
                        </Button>
                        <Button size="sm" variant="outline" onClick={selectAll}>
                            All
                        </Button>
                        <div className="flex-1" />
                        <Button size="sm" variant="outline" onClick={onMerge}>
                            <GitMerge size={14} className="mr-1" />
                            Merge
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onBulkRecolor("#3b82f6")}>
                            <Palette size={14} className="mr-1" />
                            Color
                        </Button>
                        <Button size="sm" variant="destructive" onClick={onBulkDelete}>
                            <Trash2 size={14} className="mr-1" />
                            Delete
                        </Button>
                    </div>
                )}
            </div>

            {/* Tag List with Virtual Scrolling */}
            <div
                ref={parentRef}
                className="flex-1 overflow-y-auto p-4"
            >
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
                                            className={`flex flex-col gap-2 p-4 rounded-lg border cursor-pointer transition-colors ${selectedTag?.id === tag.id
                                                ? "bg-accent border-primary"
                                                : "hover:bg-accent/50"
                                                }`}
                                            onClick={() => onTagSelect(tag)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <Checkbox
                                                    checked={selectedTagIds.includes(tag.id)}
                                                    onCheckedChange={() => toggleTagSelection(tag.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                className="w-fit"
                                                style={{
                                                    backgroundColor: tag.color || undefined,
                                                    color: tag.color ? "#fff" : undefined,
                                                }}
                                            >
                                                {tag.name}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
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
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedTag?.id === tag.id
                                        ? "bg-accent border-primary"
                                        : "hover:bg-accent/50"
                                        }`}
                                    onClick={() => onTagSelect(tag)}
                                >
                                    <Checkbox
                                        checked={selectedTagIds.includes(tag.id)}
                                        onCheckedChange={() => toggleTagSelection(tag.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <Badge
                                        variant="secondary"
                                        style={{
                                            backgroundColor: tag.color || undefined,
                                            color: tag.color ? "#fff" : undefined,
                                        }}
                                    >
                                        {tag.name}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground ml-auto">
                                        {tag.usageCount} note{tag.usageCount !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
