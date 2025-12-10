"use client"

import { useState, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useMedia, type MediaItem } from "@/hooks/use-media"
import { FileType } from "@/generated/prisma/client"
import {
    Search,
    Upload,
    Library,
    Loader2,
    FolderOpen,
    Image as ImageIcon,
    Video,
    Music,
    CheckCircle,
    Circle,
    AlertTriangle,
    Copy
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface MediaPickerProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (items: MediaItem[]) => void
    allowedTypes?: FileType[]
    multiSelect?: boolean
    title?: string
}

function getFileIcon(fileType: FileType) {
    switch (fileType) {
        case "VIDEO":
            return Video
        case "AUDIO":
            return Music
        case "IMAGE":
            return ImageIcon
        default:
            return ImageIcon
    }
}

function MediaPickerItem({
    item,
    isSelected,
    onToggle,
}: {
    item: MediaItem
    isSelected: boolean
    onToggle: () => void
}) {
    const [imageError, setImageError] = useState(false)
    const Icon = getFileIcon(item.fileType)

    const isImage = item.fileType === "IMAGE"
    const isVideo = item.fileType === "VIDEO"
    const showThumbnail = (isImage || isVideo) && !imageError

    return (
        <button
            type="button"
            onClick={onToggle}
            className={cn(
                "relative group rounded-lg border overflow-hidden transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary",
                isSelected && "ring-2 ring-primary border-primary"
            )}
        >
            {/* Selection indicator */}
            <div className="absolute top-2 left-2 z-10">
                {isSelected ? (
                    <CheckCircle className="h-5 w-5 text-primary fill-white" />
                ) : (
                    <Circle className="h-5 w-5 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>

            {/* Thumbnail / Icon */}
            <div className="aspect-square bg-muted flex items-center justify-center relative">
                {isImage && !imageError ? (
                    <Image
                        src={item.url}
                        alt={item.filename}
                        fill
                        className="object-cover"
                        onError={() => setImageError(true)}
                        sizes="120px"
                    />
                ) : (
                    <Icon className="h-10 w-10 text-muted-foreground" />
                )}
                {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="h-8 w-8 text-white" />
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="p-2 text-left bg-background">
                <p className="truncate text-xs font-medium" title={item.filename}>
                    {item.filename}
                </p>
                <p className="text-[10px] text-muted-foreground">{item.sizeFormatted}</p>
            </div>
        </button>
    )
}

function UploadDropZone({
    onUpload,
    isUploading,
    allowedTypes,
}: {
    onUpload: (files: File[]) => void
    isUploading: boolean
    allowedTypes?: FileType[]
}) {
    const [isDragOver, setIsDragOver] = useState(false)

    const acceptTypes = allowedTypes
        ? allowedTypes.map(t => {
            switch (t) {
                case "IMAGE": return "image/*"
                case "VIDEO": return "video/*"
                case "AUDIO": return "audio/*"
                default: return "*/*"
            }
        }).join(",")
        : "image/*,video/*,audio/*"

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) onUpload(files)
    }, [onUpload])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            onUpload(Array.from(files))
            e.target.value = ""
        }
    }

    return (
        <label
            className={cn(
                "flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                isUploading && "pointer-events-none opacity-50"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
        >
            {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="text-sm font-medium">
                        <span className="text-primary">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {allowedTypes
                            ? allowedTypes.map(t => t.toLowerCase()).join(", ")
                            : "Images, videos, or audio files"}
                    </p>
                </div>
            )}
            <input
                type="file"
                className="hidden"
                accept={acceptTypes}
                multiple
                onChange={handleFileSelect}
                disabled={isUploading}
            />
        </label>
    )
}

export function MediaPicker({
    isOpen,
    onClose,
    onSelect,
    allowedTypes,
    multiSelect = true,
    title = "Add Media",
}: MediaPickerProps) {
    const [activeTab, setActiveTab] = useState<"library" | "upload">("library")
    const [selectedItems, setSelectedItems] = useState<Map<string, MediaItem>>(new Map())
    const [searchQuery, setSearchQuery] = useState("")
    const [isUploading, setIsUploading] = useState(false)

    // Duplicate detection state
    const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
    const [duplicateFile, setDuplicateFile] = useState<{ file: File, existing: MediaItem } | null>(null)
    const [pendingFiles, setPendingFiles] = useState<File[]>([])

    // Determine initial filter based on allowedTypes
    const initialFilter = allowedTypes?.length === 1 ? allowedTypes[0] : null

    const {
        media,
        isLoading,
        fileType,
        setFileType,
        refresh,
        hasMore,
        loadMore,
    } = useMedia({ initialFileType: initialFilter })

    // Filter by search query
    const filteredMedia = searchQuery
        ? media.filter(m => m.filename.toLowerCase().includes(searchQuery.toLowerCase()))
        : media

    // Filter by allowed types
    const displayMedia = allowedTypes
        ? filteredMedia.filter(m => allowedTypes.includes(m.fileType))
        : filteredMedia

    const toggleSelection = (item: MediaItem) => {
        setSelectedItems(prev => {
            const next = new Map(prev)
            if (next.has(item.id)) {
                next.delete(item.id)
            } else {
                if (!multiSelect) next.clear()
                next.set(item.id, item)
            }
            return next
        })
    }

    const handleInsert = () => {
        onSelect(Array.from(selectedItems.values()))
        handleClose()
    }

    const handleClose = () => {
        setSelectedItems(new Map())
        setSearchQuery("")
        setActiveTab("library")
        onClose()
    }

    const handleUpload = async (files: File[]) => {
        setIsUploading(true)

        try {
            for (const file of files) {
                // Check for duplicates first
                const checkRes = await fetch("/api/files/check-duplicate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        filename: file.name,
                        size: file.size,
                        mimeType: file.type,
                    }),
                })

                const checkData = await checkRes.json()

                if (checkData.isDuplicate && checkData.existingFile) {
                    // Show duplicate confirmation dialog
                    setDuplicateFile({ file, existing: checkData.existingFile })
                    setPendingFiles(files.slice(files.indexOf(file) + 1))
                    setDuplicateDialogOpen(true)
                    setIsUploading(false)
                    return // Wait for user decision
                }

                // Upload the file
                const formData = new FormData()
                formData.append("file", file)

                const response = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error("Upload failed")
                }
            }

            // Refresh library and switch to it
            await refresh()
            setActiveTab("library")
        } catch (error) {
            console.error("Upload failed:", error)
        } finally {
            setIsUploading(false)
        }
    }

    // Use existing file instead of uploading duplicate
    const handleUseExisting = () => {
        if (!duplicateFile) return

        const existingItem: MediaItem = {
            ...duplicateFile.existing,
            sizeFormatted: duplicateFile.existing.sizeFormatted,
        }
        setSelectedItems(prev => {
            const next = new Map(prev)
            next.set(existingItem.id, existingItem)
            return next
        })
        setDuplicateDialogOpen(false)
        setDuplicateFile(null)
        setActiveTab("library")

        // Continue with remaining files
        if (pendingFiles.length > 0) {
            handleUpload(pendingFiles)
        }
        setPendingFiles([])
    }

    // Upload the duplicate file anyway
    const handleUploadAnyway = async () => {
        if (!duplicateFile) return

        setDuplicateDialogOpen(false)
        setIsUploading(true)

        try {
            const formData = new FormData()
            formData.append("file", duplicateFile.file)

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                throw new Error("Upload failed")
            }

            // Continue with remaining files
            if (pendingFiles.length > 0) {
                await handleUpload(pendingFiles)
            } else {
                await refresh()
                setActiveTab("library")
            }
        } catch (error) {
            console.error("Upload failed:", error)
        } finally {
            setIsUploading(false)
            setDuplicateFile(null)
            setPendingFiles([])
        }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>

                    <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "library" | "upload")} className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="library" className="gap-2">
                                <Library className="h-4 w-4" />
                                Library
                            </TabsTrigger>
                            <TabsTrigger value="upload" className="gap-2">
                                <Upload className="h-4 w-4" />
                                Upload
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="library" className="flex-1 flex flex-col min-h-0 mt-4">
                            {/* Search and filters */}
                            <div className="flex gap-2 mb-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search media..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                {!allowedTypes && (
                                    <Select
                                        value={fileType || "all"}
                                        onValueChange={(v) => setFileType(v === "all" ? null : v as FileType)}
                                    >
                                        <SelectTrigger className="w-[140px]">
                                            <SelectValue placeholder="All types" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All types</SelectItem>
                                            <SelectItem value="IMAGE">Images</SelectItem>
                                            <SelectItem value="VIDEO">Videos</SelectItem>
                                            <SelectItem value="AUDIO">Audio</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>

                            {/* Media grid */}
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {isLoading && displayMedia.length === 0 ? (
                                    <div className="flex items-center justify-center h-48">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : displayMedia.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                                        <FolderOpen className="h-12 w-12 mb-2" />
                                        <p className="font-medium">No media found</p>
                                        <p className="text-sm">Upload some files to get started</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                                            {displayMedia.map((item) => (
                                                <MediaPickerItem
                                                    key={item.id}
                                                    item={item}
                                                    isSelected={selectedItems.has(item.id)}
                                                    onToggle={() => toggleSelection(item)}
                                                />
                                            ))}
                                        </div>
                                        {hasMore && (
                                            <div className="flex justify-center mt-4 pb-2">
                                                <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoading}>
                                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="upload" className="flex-1 mt-4">
                            <UploadDropZone
                                onUpload={handleUpload}
                                isUploading={isUploading}
                                allowedTypes={allowedTypes}
                            />
                        </TabsContent>
                    </Tabs>

                    {/* Footer */}
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <p className="text-sm text-muted-foreground">
                            {selectedItems.size > 0
                                ? `${selectedItems.size} item${selectedItems.size > 1 ? "s" : ""} selected`
                                : "Select media to insert"}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button onClick={handleInsert} disabled={selectedItems.size === 0}>
                                Insert{selectedItems.size > 0 ? ` (${selectedItems.size})` : ""}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Duplicate Detection Dialog */}
            <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Duplicate File Detected
                        </DialogTitle>
                        <DialogDescription>
                            A file with the same name and size already exists in your library.
                        </DialogDescription>
                    </DialogHeader>

                    {duplicateFile && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-lg bg-muted p-4 space-y-2">
                                <p className="font-medium text-sm">File name:</p>
                                <p className="text-sm text-muted-foreground truncate">
                                    {duplicateFile.file.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Size: {duplicateFile.existing.sizeFormatted}
                                </p>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                Would you like to use the existing file or upload a new copy?
                            </p>
                        </div>
                    )}

                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button
                            variant="outline"
                            onClick={handleUseExisting}
                            className="flex items-center gap-2"
                        >
                            <Copy className="h-4 w-4" />
                            Use Existing
                        </Button>
                        <Button
                            onClick={handleUploadAnyway}
                            className="flex items-center gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Upload Anyway
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

