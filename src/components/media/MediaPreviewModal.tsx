"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Download, Trash2, X, Pencil, Check, FileText, Loader2 } from "lucide-react"
import type { MediaItem } from "@/hooks/use-media"
import { cn } from "@/lib/utils"
import { getFileContentUrl } from "@/lib/upload/file-types"

interface NoteLink {
    id: string
    title: string
}

interface MediaPreviewModalProps {
    item: MediaItem | null
    isOpen: boolean
    onClose: () => void
    onDelete: () => void
    onRename?: (newFilename: string) => void
}

export function MediaPreviewModal({
    item,
    isOpen,
    onClose,
    onDelete,
    onRename,
}: MediaPreviewModalProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [editedName, setEditedName] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [usedInNotes, setUsedInNotes] = useState<NoteLink[]>([])
    const [isLoadingNotes, setIsLoadingNotes] = useState(false)

    // Reset state when item changes
    useEffect(() => {
        if (item) {
            setEditedName(item.filename)
            setIsEditing(false)
            loadNoteUsage(item.id)
        }
    }, [item?.id])

    const loadNoteUsage = async (id: string) => {
        setUsedInNotes([])
        setIsLoadingNotes(true)
        try {
            const res = await fetch(`/api/files/${id}`)
            const data = await res.json()
            if (data.success && data.data.usedInNotes) {
                setUsedInNotes(data.data.usedInNotes)
            }
        } catch (error) {
            console.error("Failed to load note usage:", error)
        } finally {
            setIsLoadingNotes(false)
        }
    }

    const handleSaveRename = async () => {
        if (!item || editedName.trim() === item.filename) {
            setIsEditing(false)
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch(`/api/files/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: editedName.trim() }),
            })

            if (res.ok) {
                onRename?.(editedName.trim())
                setIsEditing(false)
            }
        } catch (error) {
            console.error("Failed to rename:", error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSaveRename()
        } else if (e.key === "Escape") {
            setEditedName(item?.filename || "")
            setIsEditing(false)
        }
    }

    if (!item) return null

    const contentUrl = getFileContentUrl(item.id)

    const renderPreview = () => {
        switch (item.fileType) {
            case "IMAGE":
                return (
                    <img
                        src={contentUrl}
                        alt={item.filename}
                        className="max-h-[70vh] max-w-full object-contain rounded-lg"
                    />
                )
            case "VIDEO":
                return (
                    <video
                        src={contentUrl}
                        controls
                        className="max-h-[70vh] max-w-full rounded-lg"
                    >
                        Your browser does not support video playback.
                    </video>
                )
            case "AUDIO":
                return (
                    <div className="w-full max-w-md p-8 bg-muted rounded-lg">
                        <audio
                            src={contentUrl}
                            controls
                            className="w-full"
                        >
                            Your browser does not support audio playback.
                        </audio>
                    </div>
                )
            case "DOCUMENT":
                if (item.mimeType === "application/pdf") {
                    return (
                        <iframe
                            src={contentUrl}
                            className="h-[70vh] w-full max-w-4xl rounded-lg"
                            title={item.filename}
                        />
                    )
                }
                return (
                    <div className="p-8 bg-muted rounded-lg text-center">
                        <p className="text-lg font-medium mb-4">{item.filename}</p>
                        <a
                            href={contentUrl}
                            download={item.filename}
                            className="text-primary hover:underline"
                        >
                            Download to view
                        </a>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
                <VisuallyHidden>
                    <DialogTitle>Preview: {item.filename}</DialogTitle>
                    <DialogDescription>
                        Preview, rename, download, or delete {item.filename}.
                    </DialogDescription>
                </VisuallyHidden>

                {/* Header */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="h-8 max-w-[300px]"
                                    autoFocus
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    aria-label="Save name"
                                    onClick={handleSaveRename}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    aria-label="Cancel rename"
                                    onClick={() => {
                                        setEditedName(item.filename)
                                        setIsEditing(false)
                                    }}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h3 className="truncate font-medium" title={item.filename}>
                                    {item.filename}
                                </h3>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 opacity-60 hover:opacity-100"
                                    aria-label="Rename file"
                                    onClick={() => setIsEditing(true)}
                                >
                                    <Pencil className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{item.sizeFormatted} • {item.fileType.toLowerCase()}</span>
                            {isLoadingNotes ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : usedInNotes.length > 0 && (
                                <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    Used in {usedInNotes.length} note{usedInNotes.length > 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                        <Button variant="outline" size="sm" asChild>
                            <a href={contentUrl} download={item.filename}>
                                <Download className="h-4 w-4 mr-1" />
                                Download
                            </a>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={onDelete}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Close preview" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Note usage info */}
                {usedInNotes.length > 0 && (
                    <div className="px-4 py-2 bg-muted/50 border-b">
                        <p className="text-xs text-muted-foreground mb-1">Used in:</p>
                        <div className="flex flex-wrap gap-1">
                            {usedInNotes.map((note) => (
                                <a
                                    key={note.id}
                                    href={`/notes/${note.id}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-background rounded text-xs hover:bg-primary/10 transition-colors"
                                >
                                    <FileText className="h-3 w-3" />
                                    {note.title || "Untitled"}
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Preview */}
                <div className="flex items-center justify-center p-4 min-h-[300px] bg-black/5 dark:bg-white/5">
                    {renderPreview()}
                </div>
            </DialogContent>
        </Dialog>
    )
}
