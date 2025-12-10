"use client"

import { useState, useCallback, useEffect } from "react"
import { FileType } from "@/generated/prisma/client"

export interface MediaItem {
    id: string
    url: string
    pathname: string
    filename: string
    mimeType: string
    fileType: FileType
    size: number
    sizeFormatted: string
    createdAt?: string
    noteId?: string | null
}

export interface UseMediaOptions {
    initialFileType?: FileType | null
    limit?: number
}

export interface UseMediaReturn {
    media: MediaItem[]
    isLoading: boolean
    error: string | null
    fileType: FileType | null
    setFileType: (type: FileType | null) => void
    deleteMedia: (url: string) => Promise<boolean>
    deleteMultiple: (urls: string[]) => Promise<number>
    renameMedia: (id: string, newFilename: string) => void
    refresh: () => Promise<void>
    hasMore: boolean
    loadMore: () => Promise<void>
}

export function useMedia(options?: UseMediaOptions): UseMediaReturn {
    const { initialFileType = null, limit = 20 } = options || {}

    const [media, setMedia] = useState<MediaItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [fileType, setFileType] = useState<FileType | null>(initialFileType)
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)

    const fetchMedia = useCallback(async (reset = false) => {
        setIsLoading(true)
        setError(null)

        const currentOffset = reset ? 0 : offset

        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: currentOffset.toString(),
            })

            if (fileType) {
                params.set("fileType", fileType)
            }

            const response = await fetch(`/api/files?${params.toString()}`)
            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch media")
            }

            const newMedia = data.data || []

            if (reset) {
                setMedia(newMedia)
                setOffset(newMedia.length)
            } else {
                setMedia(prev => [...prev, ...newMedia])
                setOffset(prev => prev + newMedia.length)
            }

            setHasMore(newMedia.length === limit)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch media")
        } finally {
            setIsLoading(false)
        }
    }, [fileType, limit, offset])

    const refresh = useCallback(async () => {
        setOffset(0)
        await fetchMedia(true)
    }, [fetchMedia])

    const loadMore = useCallback(async () => {
        if (!isLoading && hasMore) {
            await fetchMedia(false)
        }
    }, [fetchMedia, isLoading, hasMore])

    const deleteMedia = useCallback(async (url: string): Promise<boolean> => {
        try {
            const response = await fetch("/api/files", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || "Failed to delete file")
            }

            // Remove from local state
            setMedia(prev => prev.filter(item => item.url !== url))
            return true
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete file")
            return false
        }
    }, [])

    const deleteMultiple = useCallback(async (urls: string[]): Promise<number> => {
        let deleted = 0

        for (const url of urls) {
            const success = await deleteMedia(url)
            if (success) deleted++
        }

        return deleted
    }, [deleteMedia])

    // Update filename in local state after successful rename
    const renameMedia = useCallback((id: string, newFilename: string) => {
        setMedia(prev => prev.map(item =>
            item.id === id ? { ...item, filename: newFilename } : item
        ))
    }, [])

    // Initial fetch and refetch on filter change
    useEffect(() => {
        setOffset(0)
        fetchMedia(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileType, limit])

    return {
        media,
        isLoading,
        error,
        fileType,
        setFileType,
        deleteMedia,
        deleteMultiple,
        renameMedia,
        refresh,
        hasMore,
        loadMore,
    }
}
