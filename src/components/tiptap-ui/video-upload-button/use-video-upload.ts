"use client"

import { useCallback, useEffect, useState, useRef } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { type Editor } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"

// --- Lib ---
import { isExtensionAvailable, handleMediaUpload } from "@/lib/tiptap-utils"

// --- Icons ---
import { Video } from "lucide-react"

export const VIDEO_UPLOAD_SHORTCUT_KEY = "mod+shift+v"
export const VIDEO_MAX_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * Configuration for the video upload functionality
 */
export interface UseVideoUploadConfig {
    /**
     * The Tiptap editor instance.
     */
    editor?: Editor | null
    /**
     * Whether the button should hide when insertion is not available.
     * @default false
     */
    hideWhenUnavailable?: boolean
    /**
     * Callback function called after a successful video insertion.
     */
    onInserted?: () => void
    /**
     * Callback function called on upload error.
     */
    onError?: (error: Error) => void
}

/**
 * Checks if video can be inserted in the current editor state
 */
export function canInsertVideo(editor: Editor | null): boolean {
    if (!editor || !editor.isEditable) return false
    if (!isExtensionAvailable(editor, "video")) return false

    return editor.can().insertContent({ type: "video" })
}

/**
 * Checks if video is currently active
 */
export function isVideoActive(editor: Editor | null): boolean {
    if (!editor || !editor.isEditable) return false
    return editor.isActive("video")
}

/**
 * Inserts a video in the editor
 */
export function insertVideo(editor: Editor | null, src: string, title?: string): boolean {
    if (!editor || !editor.isEditable) return false
    if (!canInsertVideo(editor)) return false

    try {
        return editor
            .chain()
            .focus()
            .setVideo({ src, title })
            .run()
    } catch {
        return false
    }
}

/**
 * Determines if the video button should be shown
 */
export function shouldShowVideoButton(props: {
    editor: Editor | null
    hideWhenUnavailable: boolean
}): boolean {
    const { editor, hideWhenUnavailable } = props

    if (!editor || !editor.isEditable) return false
    if (!isExtensionAvailable(editor, "video")) return false

    if (hideWhenUnavailable && !editor.isActive("code")) {
        return canInsertVideo(editor)
    }

    return true
}

/**
 * Custom hook that provides video upload functionality for Tiptap editor
 */
export function useVideoUpload(config?: UseVideoUploadConfig) {
    const {
        editor: providedEditor,
        hideWhenUnavailable = false,
        onInserted,
        onError,
    } = config || {}

    const { editor } = useTiptapEditor(providedEditor)
    const isMobile = useIsBreakpoint()
    const [isVisible, setIsVisible] = useState<boolean>(true)
    const [isUploading, setIsUploading] = useState<boolean>(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const canInsert = canInsertVideo(editor)
    const isActive = isVideoActive(editor)

    useEffect(() => {
        if (!editor) return

        const handleSelectionUpdate = () => {
            setIsVisible(shouldShowVideoButton({ editor, hideWhenUnavailable }))
        }

        handleSelectionUpdate()

        editor.on("selectionUpdate", handleSelectionUpdate)

        return () => {
            editor.off("selectionUpdate", handleSelectionUpdate)
        }
    }, [editor, hideWhenUnavailable])

    const handleFileSelect = useCallback(async (file: File) => {
        if (!editor) return false

        // Validate file type
        if (!file.type.startsWith("video/")) {
            onError?.(new Error("Please select a video file"))
            return false
        }

        // Validate file size
        if (file.size > VIDEO_MAX_SIZE) {
            onError?.(new Error(`Video file must be less than 20MB`))
            return false
        }

        setIsUploading(true)

        try {
            const url = await handleMediaUpload(file)
            const success = insertVideo(editor, url, file.name)
            if (success) {
                onInserted?.()
            }
            return success
        } catch (error) {
            onError?.(error instanceof Error ? error : new Error("Upload failed"))
            return false
        } finally {
            setIsUploading(false)
        }
    }, [editor, onInserted, onError])

    const handleVideo = useCallback(() => {
        // Create and trigger file input
        if (!fileInputRef.current) {
            const input = document.createElement("input")
            input.type = "file"
            input.accept = "video/*"
            input.style.display = "none"
            input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) {
                    handleFileSelect(file)
                }
                // Reset input
                input.value = ""
            }
            document.body.appendChild(input)
            fileInputRef.current = input
        }

        fileInputRef.current.click()
    }, [handleFileSelect])

    // Cleanup file input on unmount
    useEffect(() => {
        return () => {
            if (fileInputRef.current) {
                document.body.removeChild(fileInputRef.current)
            }
        }
    }, [])

    useHotkeys(
        VIDEO_UPLOAD_SHORTCUT_KEY,
        (event) => {
            event.preventDefault()
            handleVideo()
        },
        {
            enabled: isVisible && canInsert && !isUploading,
            enableOnContentEditable: !isMobile,
            enableOnFormTags: true,
        }
    )

    return {
        isVisible,
        isActive,
        isUploading,
        handleVideo,
        handleFileSelect,
        canInsert,
        label: "Add video",
        shortcutKeys: VIDEO_UPLOAD_SHORTCUT_KEY,
        Icon: Video,
    }
}
