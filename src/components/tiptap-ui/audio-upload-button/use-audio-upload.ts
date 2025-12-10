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
import { Music } from "lucide-react"

export const AUDIO_UPLOAD_SHORTCUT_KEY = "mod+shift+a"
export const AUDIO_MAX_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * Configuration for the audio upload functionality
 */
export interface UseAudioUploadConfig {
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
     * Callback function called after a successful audio insertion.
     */
    onInserted?: () => void
    /**
     * Callback function called on upload error.
     */
    onError?: (error: Error) => void
}

/**
 * Checks if audio can be inserted in the current editor state
 */
export function canInsertAudio(editor: Editor | null): boolean {
    if (!editor || !editor.isEditable) return false
    if (!isExtensionAvailable(editor, "audio")) return false

    return editor.can().insertContent({ type: "audio" })
}

/**
 * Checks if audio is currently active
 */
export function isAudioActive(editor: Editor | null): boolean {
    if (!editor || !editor.isEditable) return false
    return editor.isActive("audio")
}

/**
 * Inserts an audio node in the editor
 */
export function insertAudio(editor: Editor | null, src: string, title?: string): boolean {
    if (!editor || !editor.isEditable) return false
    if (!canInsertAudio(editor)) return false

    try {
        return editor
            .chain()
            .focus()
            .setAudio({ src, title })
            .run()
    } catch {
        return false
    }
}

/**
 * Determines if the audio button should be shown
 */
export function shouldShowAudioButton(props: {
    editor: Editor | null
    hideWhenUnavailable: boolean
}): boolean {
    const { editor, hideWhenUnavailable } = props

    if (!editor || !editor.isEditable) return false
    if (!isExtensionAvailable(editor, "audio")) return false

    if (hideWhenUnavailable && !editor.isActive("code")) {
        return canInsertAudio(editor)
    }

    return true
}

/**
 * Custom hook that provides audio upload functionality for Tiptap editor
 */
export function useAudioUpload(config?: UseAudioUploadConfig) {
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
    const canInsert = canInsertAudio(editor)
    const isActive = isAudioActive(editor)

    useEffect(() => {
        if (!editor) return

        const handleSelectionUpdate = () => {
            setIsVisible(shouldShowAudioButton({ editor, hideWhenUnavailable }))
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
        if (!file.type.startsWith("audio/")) {
            onError?.(new Error("Please select an audio file"))
            return false
        }

        // Validate file size
        if (file.size > AUDIO_MAX_SIZE) {
            onError?.(new Error(`Audio file must be less than 20MB`))
            return false
        }

        setIsUploading(true)

        try {
            const url = await handleMediaUpload(file)
            const success = insertAudio(editor, url, file.name)
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

    const handleAudio = useCallback(() => {
        // Create and trigger file input
        if (!fileInputRef.current) {
            const input = document.createElement("input")
            input.type = "file"
            input.accept = "audio/*"
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
        AUDIO_UPLOAD_SHORTCUT_KEY,
        (event) => {
            event.preventDefault()
            handleAudio()
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
        handleAudio,
        handleFileSelect,
        canInsert,
        label: "Add audio",
        shortcutKeys: AUDIO_UPLOAD_SHORTCUT_KEY,
        Icon: Music,
    }
}
