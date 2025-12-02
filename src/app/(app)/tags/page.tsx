"use client";

import { useState, useEffect } from "react";
import { Topbar } from "@/components/Topbar";
import { TagList } from "@/components/tags/TagList";
import { TagInspector } from "@/components/tags/TagInspector";
import { MergeDialog, DeleteDialog } from "@/components/tags/TagActions";
import { TagSkeleton, TagInspectorSkeleton } from "@/components/tags/TagSkeleton";
import { BulkOperationProgressBar } from "@/components/tags/BulkOperationProgress";
import { KeyboardShortcutsDialog } from "@/components/tags/KeyboardShortcutsDialog";
import { Button } from "@/components/ui/button";
import { useTagOperations } from "@/hooks/useTagOperations";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Star, Archive, FileWarning } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Tag {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    description?: string | null;
    isFavorite?: boolean;
    isArchived?: boolean;
    usageCount: number;
    lastUsed: Date;
    createdAt: Date;
    deletedAt: Date | null;
}

interface Note {
    id: string;
    title: string;
    contentText: string;
    createdAt: Date;
    updatedAt: Date;
}

export default function TagsPage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [topNotes, setTopNotes] = useState<Note[]>([]);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("usageCount");
    const [sortOrder, setSortOrder] = useState("desc");
    const [isLoading, setIsLoading] = useState(true);
    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Filters
    const [showFavorites, setShowFavorites] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [showOrphaned, setShowOrphaned] = useState(false);

    // UI State


    // Keyboard shortcuts
    const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);

    const tagOperations = useTagOperations();

    // Fetch tags - fetch all (limit 1000) for client-side filtering
    const fetchTags = async () => {
        try {
            // We fetch a large number to handle client-side filtering efficiently
            // In a real app with 10k+ tags, we'd stick to server-side, but for <1000, client-side is faster UX
            const params = new URLSearchParams({
                limit: "1000",
                sort: "usageCount",
                order: "desc",
            });

            const response = await fetch(`/api/tags?${params}`);
            const data = await response.json();

            if (data.success) {
                setTags(data.tags.map((t: any) => ({
                    ...t,
                    lastUsed: new Date(t.lastUsed),
                    createdAt: new Date(t.createdAt),
                    deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
                })));
            }
        } catch (error) {
            console.error("Failed to fetch tags:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch tag details and notes
    const fetchTagDetails = async (tagId: string) => {
        try {
            const response = await fetch(`/api/tags/${tagId}`);
            const data = await response.json();

            if (data.success) {
                setTopNotes(data.tag.notes.map((n: any) => ({
                    ...n,
                    createdAt: new Date(n.createdAt),
                    updatedAt: new Date(n.updatedAt),
                })));

                // Update selected tag with latest data
                const updatedTag = {
                    ...data.tag,
                    lastUsed: new Date(data.tag.lastUsed),
                    createdAt: new Date(data.tag.createdAt),
                    deletedAt: data.tag.deletedAt ? new Date(data.tag.deletedAt) : null,
                };
                setSelectedTag(updatedTag);
            }
        } catch (error) {
            console.error("Failed to fetch tag details:", error);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchTags();
    }, []);

    // Client-side filtering and sorting
    useEffect(() => {
        let result = [...tags];

        // Filter by search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(t => t.name.toLowerCase().includes(q));
        }

        // Filter by toggles
        if (showFavorites) result = result.filter(t => t.isFavorite);
        if (showArchived) result = result.filter(t => t.isArchived);
        if (showOrphaned) result = result.filter(t => t.usageCount === 0);

        // Sort
        result.sort((a, b) => {
            // @ts-ignore - dynamic key access
            let valA = a[sortBy];
            // @ts-ignore
            let valB = b[sortBy];

            // Handle strings
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            // Handle dates
            if (valA instanceof Date) valA = valA.getTime();
            if (valB instanceof Date) valB = valB.getTime();

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        setFilteredTags(result);
    }, [tags, searchQuery, showFavorites, showArchived, showOrphaned, sortBy, sortOrder]);

    // Handle deep linking from URL
    const searchParams = useSearchParams();
    useEffect(() => {
        const tagIdFromUrl = searchParams.get("id");
        if (tagIdFromUrl && tags.length > 0 && !selectedTag) {
            const tagToSelect = tags.find(t => t.id === tagIdFromUrl);
            if (tagToSelect) {
                setSelectedTag(tagToSelect);
            }
        }
    }, [searchParams, tags, selectedTag]);

    useEffect(() => {
        if (selectedTag) {
            fetchTagDetails(selectedTag.id);
        }
    }, [selectedTag?.id]);

    const handleTagSelect = (tag: Tag) => {
        setSelectedTag(tag);
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
    };

    const handleSortChange = (sort: string, order: string) => {
        setSortBy(sort);
        setSortOrder(order);
    };

    const handleRename = async (newName: string) => {
        if (!selectedTag) return;

        // Optimistic update
        const updatedLocalTag = { ...selectedTag, name: newName };
        setSelectedTag(updatedLocalTag);
        setTags(tags.map(t => t.id === selectedTag.id ? { ...t, name: newName } : t));

        const updatedTag = await tagOperations.updateTag(selectedTag.id, { name: newName } as any);
        if (updatedTag) {
            // Confirm with server data
            const processedTag = {
                ...updatedTag,
                lastUsed: new Date(updatedTag.lastUsed),
                createdAt: new Date(updatedTag.createdAt),
                deletedAt: updatedTag.deletedAt ? new Date(updatedTag.deletedAt) : null,
            };
            setSelectedTag(prev => prev?.id === updatedTag.id ? { ...prev, ...processedTag } : prev);
            setTags(prev => prev.map(t => t.id === updatedTag.id ? { ...t, ...processedTag } : t));
        } else {
            // Revert on failure
            await fetchTags();
            if (selectedTag) await fetchTagDetails(selectedTag.id);
        }
    };

    const handleRecolor = async (color: string) => {
        if (!selectedTag) return;

        // Optimistic update
        const updatedLocalTag = { ...selectedTag, color };
        setSelectedTag(updatedLocalTag);
        setTags(tags.map(t => t.id === selectedTag.id ? { ...t, color } : t));

        const updatedTag = await tagOperations.updateTag(selectedTag.id, { color } as any);
        if (updatedTag) {
            const processedTag = {
                ...updatedTag,
                lastUsed: new Date(updatedTag.lastUsed),
                createdAt: new Date(updatedTag.createdAt),
                deletedAt: updatedTag.deletedAt ? new Date(updatedTag.deletedAt) : null,
            };
            setSelectedTag(prev => prev?.id === updatedTag.id ? { ...prev, ...processedTag } : prev);
            setTags(prev => prev.map(t => t.id === updatedTag.id ? { ...t, ...processedTag } : t));
        } else {
            await fetchTags();
            if (selectedTag) await fetchTagDetails(selectedTag.id);
        }
    };

    const handleUpdateDescription = async (description: string) => {
        if (!selectedTag) return;

        // Optimistic update
        const updatedLocalTag = { ...selectedTag, description };
        setSelectedTag(updatedLocalTag);
        setTags(tags.map(t => t.id === selectedTag.id ? { ...t, description } : t));

        const updatedTag = await tagOperations.updateTag(selectedTag.id, { description } as any);
        if (updatedTag) {
            const processedTag = {
                ...updatedTag,
                lastUsed: new Date(updatedTag.lastUsed),
                createdAt: new Date(updatedTag.createdAt),
                deletedAt: updatedTag.deletedAt ? new Date(updatedTag.deletedAt) : null,
            };
            setSelectedTag(prev => prev?.id === updatedTag.id ? { ...prev, ...processedTag } : prev);
            setTags(prev => prev.map(t => t.id === updatedTag.id ? { ...t, ...processedTag } : t));
        } else {
            await fetchTags();
            if (selectedTag) await fetchTagDetails(selectedTag.id);
        }
    };

    const handleToggleFavorite = async () => {
        if (!selectedTag) return;

        // Optimistic update
        const newStatus = !selectedTag.isFavorite;
        const updatedLocalTag = { ...selectedTag, isFavorite: newStatus };
        setSelectedTag(updatedLocalTag);
        setTags(tags.map(t => t.id === selectedTag.id ? { ...t, isFavorite: newStatus } : t));

        const success = await tagOperations.toggleFavorite(selectedTag.id);
        if (!success) {
            // Revert on failure
            await fetchTags();
            if (selectedTag) await fetchTagDetails(selectedTag.id);
        }
    };

    const handleToggleArchive = async () => {
        if (!selectedTag) return;

        // Optimistic update
        const newStatus = !selectedTag.isArchived;
        const updatedLocalTag = { ...selectedTag, isArchived: newStatus };
        setSelectedTag(updatedLocalTag);
        setTags(tags.map(t => t.id === selectedTag.id ? { ...t, isArchived: newStatus } : t));

        const success = await tagOperations.toggleArchive(selectedTag.id);
        if (!success) {
            // Revert on failure
            await fetchTags();
            if (selectedTag) await fetchTagDetails(selectedTag.id);
        }
    };

    const handleDelete = async () => {
        if (!selectedTag) return;

        const success = await tagOperations.deleteTag(selectedTag.id);
        if (success) {
            setSelectedTag(null);
            await fetchTags();
        }
    };

    const handleBulkDelete = () => {
        setIsDeleteDialogOpen(true);
    };

    const confirmBulkDelete = async () => {
        const count = await tagOperations.bulkDelete(selectedTagIds);
        if (count > 0) {
            setSelectedTagIds([]);
            setIsDeleteDialogOpen(false);
            await fetchTags();
        }
    };

    const handleBulkRecolor = async (color: string) => {
        const count = await tagOperations.bulkRecolor(selectedTagIds, color);
        if (count > 0) {
            await fetchTags();
        }
    };

    const handleMerge = () => {
        if (selectedTagIds.length < 2) {
            return;
        }
        setIsMergeDialogOpen(true);
    };

    const confirmMerge = async (targetTagId: string) => {
        const count = await tagOperations.mergeTags(
            selectedTagIds.filter(id => id !== targetTagId),
            targetTagId
        );
        if (count >= 0) {
            setSelectedTagIds([]);
            setIsMergeDialogOpen(false);
            await fetchTags();
        }
    };

    const handleRemoveNoteTag = async (noteId: string) => {
        if (!selectedTag) return;

        try {
            // Fetch note to get current tags
            const noteResponse = await fetch(`/api/notes/${noteId}`);
            const noteData = await noteResponse.json();

            if (!noteData.success) {
                throw new Error("Failed to fetch note");
            }

            // Remove the tag
            const updatedTags = noteData.note.tags
                .filter((t: any) => t.id !== selectedTag.id)
                .map((t: any) => t.name);

            const response = await fetch(`/api/notes/${noteId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tags: updatedTags }),
            });

            const data = await response.json();

            if (data.success) {
                await fetchTagDetails(selectedTag.id);
                await fetchTags();
            }
        } catch (error) {
            console.error("Failed to remove tag from note:", error);
        }
    };

    // Keyboard shortcuts definition
    const keyboardShortcuts = [
        {
            key: "F",
            ctrl: true,
            handler: () => {
                // Focus search input - handled via prop in TagList if we add a ref there
                // For now, we'll just log or maybe add a ref to TagList later
                const searchInput = document.querySelector('input[placeholder="Search tags..."]') as HTMLInputElement;
                if (searchInput) searchInput.focus();
            },
            description: "Focus search",
        },
        {
            key: "A",
            ctrl: true,
            handler: () => {
                if (filteredTags.length > 0) {
                    setSelectedTagIds(filteredTags.map(t => t.id));
                }
            },
            description: "Select all tags",
        },
        {
            key: "Delete",
            handler: () => {
                if (selectedTagIds.length > 0) {
                    handleBulkDelete();
                }
            },
            description: "Delete selected tags",
        },
        {
            key: "Escape",
            handler: () => {
                setSelectedTagIds([]);
                setShowShortcutsDialog(false);
            },
            description: "Clear selection / Close dialogs",
        },
        {
            key: "?",
            shift: true,
            handler: () => {
                setShowShortcutsDialog(true);
            },
            description: "Show keyboard shortcuts",
        },
    ];

    useKeyboardShortcuts({
        shortcuts: keyboardShortcuts,
        enabled: !showShortcutsDialog && !isMergeDialogOpen && !isDeleteDialogOpen,
    });

    const selectedTagsForMerge = tags.filter((t) => selectedTagIds.includes(t.id));
    const selectedTagsForDelete = selectedTagIds
        .map((id) => tags.find((t) => t.id === id))
        .filter((t): t is Tag => t !== undefined);

    if (isLoading) {
        return (
            <div className="h-screen flex flex-col">
                <Topbar>
                    <div className="text-lg font-semibold">Tags</div>
                </Topbar>
                <div className="flex-1 flex overflow-hidden">
                    <div className="w-1/2 border-r p-4">
                        <TagSkeleton count={12} />
                    </div>
                    <div className="flex-1 p-6">
                        <TagInspectorSkeleton />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            <Topbar>
                <div className="flex items-center justify-between w-full">
                    <div className="text-lg font-semibold">Tags</div>

                    {/* Filter Toggles */}
                    <div className="flex gap-2">
                        <Button
                            variant={showFavorites ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowFavorites(!showFavorites)}
                        >
                            <Star size={14} className="mr-1" />
                            Favorites
                        </Button>
                        <Button
                            variant={showArchived ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowArchived(!showArchived)}
                        >
                            <Archive size={14} className="mr-1" />
                            Archived
                        </Button>
                        <Button
                            variant={showOrphaned ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowOrphaned(!showOrphaned)}
                        >
                            <FileWarning size={14} className="mr-1" />
                            Orphaned
                        </Button>
                    </div>
                </div>
            </Topbar>



            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane - Tag List */}
                <div className="w-1/2 border-r">
                    <TagList
                        tags={filteredTags}
                        selectedTag={selectedTag}
                        selectedTagIds={selectedTagIds}
                        onTagSelect={handleTagSelect}
                        onTagsSelectionChange={setSelectedTagIds}
                        onSearch={handleSearch}
                        onSortChange={handleSortChange}
                        onBulkDelete={handleBulkDelete}
                        onBulkRecolor={handleBulkRecolor}
                        onMerge={handleMerge}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                    />
                </div>

                {/* Right Pane - Tag Inspector */}
                <div className="flex-1">
                    <TagInspector
                        tag={selectedTag}
                        topNotes={topNotes}
                        onRename={handleRename}
                        onRecolor={handleRecolor}
                        onDelete={handleDelete}
                        onMerge={handleMerge}
                        onRemoveNoteTag={handleRemoveNoteTag}
                        onUpdateDescription={handleUpdateDescription}
                        onToggleFavorite={handleToggleFavorite}
                        onToggleArchive={handleToggleArchive}
                    />
                </div>
            </div>

            {/* Bulk Operation Progress */}
            {tagOperations.progress && (
                <BulkOperationProgressBar progress={tagOperations.progress} />
            )}

            {/* Dialogs */}
            <MergeDialog
                isOpen={isMergeDialogOpen}
                onClose={() => setIsMergeDialogOpen(false)}
                sourceTags={selectedTagsForMerge}
                allTags={tags}
                onConfirm={confirmMerge}
            />

            <DeleteDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                tags={selectedTagsForDelete}
                onConfirm={confirmBulkDelete}
            />

            <KeyboardShortcutsDialog
                isOpen={showShortcutsDialog}
                onClose={() => setShowShortcutsDialog(false)}
                shortcuts={keyboardShortcuts}
            />
        </div>
    );
}
