"use client"

import { useState } from "react"
import Image from "next/image"
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
    const showThumbnail = (isImage || isVideo) && !imageError

    return (
        <div
            className={cn(
                "group relative rounded-lg border bg-card transition-all hover:shadow-md",
                isSelected && "ring-2 ring-primary",
                "cursor-pointer"
            )}
            onClick={() => {
                if (isSelectionMode) {
                    onSelect()
                } else {
                    onPreview()
                }
            }}
        >
            {/* Selection button */}
            {isSelectionMode && (
                <button
                    className="absolute top-2 left-2 z-10"
                    onClick={(e) => {
                        e.stopPropagation()
                        onSelect()
                    }}
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
                    <>
                        <Image
                            src={item.url}
                            alt={item.filename}
                            fill
                            className="object-cover"
                            onError={() => setImageError(true)}
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                        />
                        {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="h-10 w-10 text-white fill-white" />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <Icon className={cn("h-12 w-12", iconColor)} />
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
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <a
                    href={item.url}
                    download={item.filename}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full bg-background/80 p-1.5 hover:bg-background shadow-sm"
                >
                    <Download className="h-4 w-4" />
                </a>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                    className="rounded-full bg-background/80 p-1.5 hover:bg-destructive hover:text-destructive-foreground shadow-sm"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
