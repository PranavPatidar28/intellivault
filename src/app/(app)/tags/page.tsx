"use client";

import { useState, useEffect, useRef } from "react";
import { Topbar } from "@/components/Topbar";
import { TagList } from "@/components/tags/TagList";
import { TagInspector } from "@/components/tags/TagInspector";
import { MergeDialog, DeleteDialog } from "@/components/tags/TagActions";
import { TagSkeleton, TagInspectorSkeleton } from "@/components/tags/TagSkeleton";
import { BulkOperationProgressBar } from "@/components/tags/BulkOperationProgress";
import { KeyboardShortcutsDialog } from "@/components/tags/KeyboardShortcutsDialog";
import { TagAnalyticsDashboard } from "@/components/tags/TagAnalyticsDashboard";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { useTagOperations } from "@/hooks/useTagOperations";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import { Star, Archive, FileWarning, Download, Upload, BarChart3 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

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

    // Import/Export
    const [isImporting, setIsImporting] = useState(false);

    // Analytics overlay
    const [showAnalytics, setShowAnalytics] = useState(false);

    const isMobile = useIsMobile();

    const tagOperations = useTagOperations();

    // Tracks the most recently requested tag-detail fetch. Because detail
    // requests are async and can resolve out of order (a heavy tag embeds more
    // notes and returns slower), a stale response must never be allowed to
    // overwrite a newer selection — otherwise clicking A then B can "open" A
    // when A's response lands last. We gate the state writes on this token.
    const latestDetailReq = useRef<string | null>(null);

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
        // Mark this as the latest detail request before awaiting.
        latestDetailReq.current = tagId;
        try {
            const response = await fetch(`/api/tags/${tagId}`);
            const data = await response.json();

            // Drop a response that a newer selection has already superseded, so
            // an out-of-order/slow response can't open the wrong tag's notes.
            if (latestDetailReq.current !== tagId) return;

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
                // Enrich ONLY the tag that is still selected — never switch the
                // selection to this response's tag, and never resurrect a tag
                // that was cleared/deleted while the request was in flight.
                setSelectedTag(prev => prev?.id === tagId ? { ...prev, ...updatedTag } : prev);
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

    // Handle deep linking from URL — drive selection off the URL id directly so
    // navigating to /tags?id=other updates the selection even when a tag is
    // already selected (back/forward, NoteTags links, etc.).
    const searchParams = useSearchParams();
    const tagIdFromUrl = searchParams.get("id");
    // Track the last URL id we applied so this effect only reacts to an actual
    // change in the param — not to selection or tag-list changes. Without this,
    // clicking another tag in the list would instantly revert to the URL tag.
    const lastAppliedUrlId = useRef<string | null>(null);
    useEffect(() => {
        if (tagIdFromUrl && tagIdFromUrl !== lastAppliedUrlId.current && tags.length > 0) {
            const tagToSelect = tags.find(t => t.id === tagIdFromUrl);
            if (tagToSelect) {
                lastAppliedUrlId.current = tagIdFromUrl;
                setSelectedTag(tagToSelect);
            }
        }
    }, [tagIdFromUrl, tags]);

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
            // Cancel any in-flight detail fetch so it can't resurrect the tag.
            latestDetailReq.current = null;
            setSelectedTag(null);
            await fetchTags();
        }
    };

    const handleBulkDelete = () => {
        setIsDeleteDialogOpen(true);
    };

    const confirmBulkDelete = async () => {
        const deletedIds = [...selectedTagIds];
        const count = await tagOperations.bulkDelete(selectedTagIds);
        if (count > 0) {
            // Clear the inspector if the tag it's showing was just deleted.
            if (selectedTag && deletedIds.includes(selectedTag.id)) {
                setSelectedTag(null);
            }
            setSelectedTagIds([]);
            setIsDeleteDialogOpen(false);
            await fetchTags();
        }
    };

    const handleBulkRecolor = async (color: string) => {
        const count = await tagOperations.bulkRecolor(selectedTagIds, color);
        if (count > 0) {
            await fetchTags();
            if (selectedTag) await fetchTagDetails(selectedTag.id);
        }
    };

    const handleMerge = () => {
        if (selectedTagIds.length < 2) {
            return;
        }
        setIsMergeDialogOpen(true);
    };

    const confirmMerge = async (targetTagId: string) => {
        const mergedSources = selectedTagIds.filter(id => id !== targetTagId);
        const count = await tagOperations.mergeTags(mergedSources, targetTagId);
        // mergeTags returns null on failure and a (possibly zero) count on success,
        // so only run the success branch when it isn't null.
        if (count !== null) {
            // The inspected tag may have been merged away.
            if (selectedTag && mergedSources.includes(selectedTag.id)) {
                setSelectedTag(null);
            }
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

            // Remove the tag, keyed by id (names can collide). The PUT endpoint
            // resolves tags by name, so we send the remaining names.
            const updatedTags = noteData.note.tags
                .filter((t: any) => t.id !== selectedTag.id)
                .map((t: any) => t.name);

            const response = await fetch(`/api/notes/${noteId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tags: updatedTags }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to update note");
            }

            toast.success("Tag removed from note");
            await fetchTagDetails(selectedTag.id);
            await fetchTags();
        } catch (error) {
            console.error("Failed to remove tag from note:", error);
            toast.error("Couldn't remove tag", {
                description: error instanceof Error ? error.message : undefined,
            });
        }
    };

    // Export / Import
    const handleExport = async (format: "json" | "csv") => {
        try {
            const response = await fetch("/api/tags/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format }),
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "Export failed");
            }
            const blob = new Blob([data.data], {
                type: format === "json" ? "application/json" : "text/csv",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.filename || `tags-export.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success(`Exported tags as ${format.toUpperCase()}`);
        } catch (error) {
            toast.error("Couldn't export tags", {
                description: error instanceof Error ? error.message : undefined,
            });
        }
    };

    const handleImportFile = async (file: File) => {
        const format: "json" | "csv" = file.name.toLowerCase().endsWith(".csv")
            ? "csv"
            : "json";
        setIsImporting(true);
        try {
            const text = await file.text();
            const response = await fetch("/api/tags/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: text, format, strategy: "merge" }),
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || "Import failed");
            }
            toast.success("Tags imported", {
                description: `${data.imported} imported, ${data.skipped} skipped`,
            });
            await fetchTags();
        } catch (error) {
            toast.error("Couldn't import tags", {
                description: error instanceof Error ? error.message : undefined,
            });
        } finally {
            setIsImporting(false);
        }
    };

    // Keyboard shortcuts definition
    const keyboardShortcuts = [
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
            <div className="h-full flex flex-col">
                <Topbar>
                    <h1 className="text-lg font-semibold tracking-tight">Tags</h1>
                </Topbar>
                <div className="flex-1 flex overflow-hidden">
                    <div className="w-full md:w-1/2 border-r p-4">
                        <TagSkeleton count={12} />
                    </div>
                    <div className="hidden md:block flex-1 p-6">
                        <TagInspectorSkeleton />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <Topbar>
                <h1 className="text-lg font-semibold tracking-tight shrink-0">Tags</h1>

                {/* Filter toggles + import/export. Wraps on narrow screens and
                    collapses button labels behind sm: so it never overflows. */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                        variant={showFavorites ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowFavorites(!showFavorites)}
                        aria-pressed={showFavorites}
                    >
                        <Star size={14} className="sm:mr-1" />
                        <span className="hidden sm:inline">Favorites</span>
                    </Button>
                    <Button
                        variant={showArchived ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowArchived(!showArchived)}
                        aria-pressed={showArchived}
                    >
                        <Archive size={14} className="sm:mr-1" />
                        <span className="hidden sm:inline">Archived</span>
                    </Button>
                    <Button
                        variant={showOrphaned ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowOrphaned(!showOrphaned)}
                        aria-pressed={showOrphaned}
                    >
                        <FileWarning size={14} className="sm:mr-1" />
                        <span className="hidden sm:inline">Orphaned</span>
                    </Button>

                    <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

                    <Button
                        variant={showAnalytics ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowAnalytics((v) => !v)}
                        aria-pressed={showAnalytics}
                        aria-label="Toggle tag analytics"
                    >
                        <BarChart3 size={14} className="sm:mr-1" />
                        <span className="hidden sm:inline">Analytics</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport("json")}
                        aria-label="Export tags as JSON"
                    >
                        <Download size={14} className="sm:mr-1" />
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isImporting}
                        onClick={() => document.getElementById("tag-import-input")?.click()}
                        aria-label="Import tags from a file"
                    >
                        <Upload size={14} className="sm:mr-1" />
                        <span className="hidden sm:inline">
                            {isImporting ? "Importing..." : "Import"}
                        </span>
                    </Button>
                    <input
                        id="tag-import-input"
                        type="file"
                        accept=".json,.csv,application/json,text/csv"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImportFile(file);
                            e.target.value = "";
                        }}
                    />
                </div>
            </Topbar>

            {showAnalytics && (
                <div className="border-b bg-muted/30 p-4 overflow-y-auto max-h-[45vh]">
                    <TagAnalyticsDashboard />
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane - Tag List (full width on mobile, half on md+) */}
                <div className="w-full md:w-1/2 md:border-r">
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

                {/* Right Pane - Tag Inspector (inline on md+). Rendered only when
                    not mobile so the mobile Sheet copy is the single instance and
                    related-tag fetches don't fire twice. */}
                {!isMobile && (
                    <div className="hidden md:block flex-1">
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
                )}
            </div>

            {/* Mobile inspector — slides in as a sheet when a tag is selected */}
            {isMobile && (
                <Sheet
                    open={!!selectedTag}
                    onOpenChange={(open) => {
                        if (!open) setSelectedTag(null);
                    }}
                >
                    <SheetContent side="right" className="w-full p-0 sm:max-w-md">
                        <SheetHeader className="sr-only">
                            <SheetTitle>Tag details</SheetTitle>
                        </SheetHeader>
                        <div className="h-full overflow-hidden pt-2">
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
                    </SheetContent>
                </Sheet>
            )}

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
