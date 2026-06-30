"use client"

import { useState } from "react"
import { FileType } from "@/generated/prisma/client"
import {
    FileVideo,
    FileAudio,
    FileImage,
    FileText,
    Trash2,
    Download,
    CheckCircle,
    Circle,
    Play
} from "lucide-react"
import type { MediaItem } from "@/hooks/use-media"
import { cn } from "@/lib/utils"
import { getFileContentUrl } from "@/lib/upload/file-types"

interface MediaCardProps {
    item: MediaItem
    isSelected: boolean
    isSelectionMode: boolean
    onSelect: () => void
    onDelete: () => void
    onPreview: () => void
}

function getFileIcon(fileType: FileType) {
    switch (fileType) {
        case "VIDEO":
            return FileVideo
        case "AUDIO":
            return FileAudio
        case "IMAGE":
            return FileImage
        case "DOCUMENT":
            return FileText
        default:
            return FileText
    }
}

function getFileColor(fileType: FileType): string {
    switch (fileType) {
        case "VIDEO":
            return "text-purple-500"
        case "AUDIO":
            return "text-blue-500"
        case "IMAGE":
            return "text-green-500"
        case "DOCUMENT":
            return "text-orange-500"
        default:
            return "text-gray-500"
    }
}

export function MediaCard({
    item,
    isSelected,
    isSelectionMode,
    onSelect,
    onDelete,
    onPreview,
}: MediaCardProps) {
    const [imageError, setImageError] = useState(false)
    const Icon = getFileIcon(item.fileType)
    const iconColor = getFileColor(item.fileType)

    const isImage = item.fileType === "IMAGE"
    const isVideo = item.fileType === "VIDEO"
    // Only images can be shown as a real thumbnail. A <video> stream cannot be
    // decoded by <img>, so treating videos as image thumbnails always errored
    // out and wasted a full-file fetch — show the icon + Play overlay instead.
    const showThumbnail = isImage && !imageError

    const activate = () => {
        if (isSelectionMode) {
            onSelect()
        } else {
            onPreview()
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={
                isSelectionMode
                    ? `${isSelected ? "Deselect" : "Select"} ${item.filename}`
                    : `Open ${item.filename}`
            }
            aria-pressed={isSelectionMode ? isSelected : undefined}
            className={cn(
                "group relative rounded-lg border bg-card text-left transition-all hover:shadow-md",
                "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && "ring-2 ring-primary"
            )}
            onClick={activate}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    activate()
                }
            }}
        >
            {/* Selection button */}
            {isSelectionMode && (
                <button
                    type="button"
                    aria-label={isSelected ? `Deselect ${item.filename}` : `Select ${item.filename}`}
                    aria-pressed={isSelected}
                    className="absolute top-2 left-2 z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(e) => {
                        e.stopPropagation()
                        onSelect()
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    {isSelected ? (
                        <CheckCircle className="h-5 w-5 text-primary fill-primary" />
                    ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                </button>
            )}

            {/* Thumbnail / Icon */}
            <div className="relative aspect-square overflow-hidden rounded-t-lg bg-muted">
                {showThumbnail ? (
                    /* Plain <img> (not next/image): the proxy is cookie-
                       authenticated, but next/image's optimizer fetches
                       server-side without the user's cookie and would 401. */
                    <img
                        src={getFileContentUrl(item.id)}
                        alt={item.filename}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={() => setImageError(true)}
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <Icon className={cn("h-12 w-12", iconColor)} />
                    </div>
                )}
                {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
                            <Play className="h-5 w-5 text-white fill-white" />
                        </span>
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-3">
                <p className="truncate text-sm font-medium" title={item.filename}>
                    {item.filename}
                </p>
                <p className="text-xs text-muted-foreground">{item.sizeFormatted}</p>
            </div>

            {/* Action buttons */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <a
                    href={getFileContentUrl(item.id)}
                    download={item.filename}
                    aria-label={`Download ${item.filename}`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="rounded-full bg-background/80 p-1.5 hover:bg-background shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Download className="h-4 w-4" />
                </a>
                <button
                    type="button"
                    aria-label={`Delete ${item.filename}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="rounded-full bg-background/80 p-1.5 hover:bg-destructive hover:text-destructive-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
