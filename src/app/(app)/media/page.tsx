"use client"

import { useState } from "react"
import { useMedia, type MediaItem } from "@/hooks/use-media"
import { MediaCard } from "@/components/media/MediaCard"
import { MediaPreviewModal } from "@/components/media/MediaPreviewModal"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { FileType } from "@/generated/prisma/client"
import {
    Trash2,
    CheckSquare,
    X,
    Loader2,
    FolderOpen,
    RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function MediaPage() {
    const { toast } = useToast()
    const {
        media,
        isLoading,
        error,
        fileType,
        setFileType,
        deleteMedia,
        deleteMultiple,
        refresh,
        hasMore,
        loadMore,
    } = useMedia()

    const [isSelectionMode, setIsSelectionMode] = useState(false)
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())
    const [previewItem, setPreviewItem] = useState<MediaItem | null>(null)
    const [deleteConfirmItem, setDeleteConfirmItem] = useState<MediaItem | null>(null)
    const [affectedNotes, setAffectedNotes] = useState<Array<{ id: string, title: string }>>([])
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isLoadingNotes, setIsLoadingNotes] = useState(false)

    // Fetch affected notes when delete confirmation is requested
    const handleDeleteRequest = async (item: MediaItem) => {
        setDeleteConfirmItem(item)
        setIsLoadingNotes(true)
        try {
            const res = await fetch(`/api/files/${item.id}`)
            const data = await res.json()
            if (data.success && data.data.usedInNotes) {
                setAffectedNotes(data.data.usedInNotes)
            } else {
                setAffectedNotes([])
            }
        } catch (error) {
            console.error("Failed to fetch affected notes:", error)
            setAffectedNotes([])
        } finally {
            setIsLoadingNotes(false)
        }
    }

    const handleToggleSelection = (url: string) => {
        setSelectedUrls((prev) => {
            const next = new Set(prev)
            if (next.has(url)) {
                next.delete(url)
            } else {
                next.add(url)
            }
            return next
        })
    }

    const handleSelectAll = () => {
        if (selectedUrls.size === media.length) {
            setSelectedUrls(new Set())
        } else {
            setSelectedUrls(new Set(media.map((m) => m.url)))
        }
    }

    const handleExitSelectionMode = () => {
        setIsSelectionMode(false)
        setSelectedUrls(new Set())
    }

    const handleDeleteSingle = async () => {
        if (!deleteConfirmItem) return

        setIsDeleting(true)
        const success = await deleteMedia(deleteConfirmItem.url)
        setIsDeleting(false)

        if (success) {
            const noteCount = affectedNotes.length
            toast({
                title: "File deleted",
                description: noteCount > 0
                    ? `${deleteConfirmItem.filename} and its references in ${noteCount} note(s) have been removed.`
                    : `${deleteConfirmItem.filename} has been deleted.`,
            })
            setDeleteConfirmItem(null)
            setAffectedNotes([])
            if (previewItem?.url === deleteConfirmItem.url) {
                setPreviewItem(null)
            }
        } else {
            toast({
                title: "Error",
                description: "Failed to delete file. Please try again.",
                variant: "destructive",
            })
        }
    }

    const handleBulkDelete = async () => {
        setIsDeleting(true)
        const count = await deleteMultiple(Array.from(selectedUrls))
        setIsDeleting(false)

        toast({
            title: "Files deleted",
            description: `${count} file(s) have been deleted.`,
        })

        setIsBulkDeleteOpen(false)
        setSelectedUrls(new Set())
        setIsSelectionMode(false)
    }

    return (
        <div className="container mx-auto py-6 px-4">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Media Library</h1>
                    <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Filters and actions */}
                <div className="flex flex-wrap items-center gap-4">
                    <Select
                        value={fileType || "all"}
                        onValueChange={(value) =>
                            setFileType(value === "all" ? null : (value as FileType))
                        }
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All media</SelectItem>
                            <SelectItem value="IMAGE">Images</SelectItem>
                            <SelectItem value="VIDEO">Videos</SelectItem>
                            <SelectItem value="AUDIO">Audio</SelectItem>
                            <SelectItem value="DOCUMENT">Documents</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex-1" />

                    {isSelectionMode ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                                {selectedUrls.size} selected
                            </span>
                            <Button variant="outline" size="sm" onClick={handleSelectAll}>
                                {selectedUrls.size === media.length ? "Deselect all" : "Select all"}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={selectedUrls.size === 0}
                                onClick={() => setIsBulkDeleteOpen(true)}
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete selected
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleExitSelectionMode}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSelectionMode(true)}
                            disabled={media.length === 0}
                        >
                            <CheckSquare className="h-4 w-4 mr-1" />
                            Select
                        </Button>
                    )}
                </div>
            </div>

            {/* Error state */}
            {error && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4 mb-6">
                    <p className="text-destructive">{error}</p>
                </div>
            )}

            {/* Loading state */}
            {isLoading && media.length === 0 && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Empty state */}
            {!isLoading && media.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <FolderOpen className="h-16 w-16 mb-4" />
                    <p className="text-lg font-medium">No media files</p>
                    <p className="text-sm">
                        {fileType
                            ? `No ${fileType.toLowerCase()} files found`
                            : "Upload media in your notes to see them here"}
                    </p>
                </div>
            )}

            {/* Media grid */}
            {media.length > 0 && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {media.map((item) => (
                            <MediaCard
                                key={item.id}
                                item={item}
                                isSelected={selectedUrls.has(item.url)}
                                isSelectionMode={isSelectionMode}
                                onSelect={() => handleToggleSelection(item.url)}
                                onDelete={() => handleDeleteRequest(item)}
                                onPreview={() => setPreviewItem(item)}
                            />
                        ))}
                    </div>

                    {/* Load more */}
                    {hasMore && (
                        <div className="flex justify-center mt-8">
                            <Button
                                variant="outline"
                                onClick={loadMore}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : null}
                                Load more
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Preview modal */}
            <MediaPreviewModal
                item={previewItem}
                isOpen={!!previewItem}
                onClose={() => setPreviewItem(null)}
                onDelete={() => {
                    if (previewItem) {
                        handleDeleteRequest(previewItem)
                    }
                }}
            />

            {/* Single delete confirmation */}
            <Dialog
                open={!!deleteConfirmItem}
                onOpenChange={(open) => !open && setDeleteConfirmItem(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete "{deleteConfirmItem?.filename}"?</DialogTitle>
                        <DialogDescription asChild>
                            <div>
                                {isLoadingNotes ? (
                                    <div className="flex items-center gap-2 py-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Checking usage...</span>
                                    </div>
                                ) : affectedNotes.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-amber-600 dark:text-amber-400 font-medium">
                                            ⚠️ This file is used in {affectedNotes.length} note(s):
                                        </p>
                                        <ul className="list-disc list-inside text-sm pl-2 max-h-32 overflow-y-auto">
                                            {affectedNotes.map(note => (
                                                <li key={note.id}>{note.title || "Untitled"}</li>
                                            ))}
                                        </ul>
                                        <p className="text-sm">Deleting will remove this media from all these notes.</p>
                                    </div>
                                ) : (
                                    <p>Are you sure you want to delete this file? This action cannot be undone.</p>
                                )}
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => { setDeleteConfirmItem(null); setAffectedNotes([]); }}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteSingle}
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk delete confirmation */}
            <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete {selectedUrls.size} file(s)?</DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-3">
                                <p>Are you sure you want to delete these files? This action cannot be undone.</p>
                                <p className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-2">
                                    ⚠️ Any notes using these files will have them removed automatically.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsBulkDeleteOpen(false)}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Delete all
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

