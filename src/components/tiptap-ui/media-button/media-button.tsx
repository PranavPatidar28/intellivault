"use client"

import { forwardRef, useState, useCallback } from "react"
import { type Editor } from "@tiptap/react"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { useMediaPicker } from "@/hooks/use-media-picker"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Components ---
import { MediaPicker } from "@/components/media/MediaPicker"

// --- Icons ---
import { ImagePlus } from "lucide-react"

// --- Types ---
import { FileType } from "@/generated/prisma/client"

export interface MediaButtonProps extends Omit<ButtonProps, "type" | "onClick"> {
    /**
     * The Tiptap editor instance.
     */
    editor?: Editor | null
    /**
     * Optional text to display alongside the icon.
     */
    text?: string
    /**
     * Allowed file types for the picker
     */
    allowedTypes?: FileType[]
    /**
     * Allow selecting multiple items
     * @default true
     */
    multiSelect?: boolean
    /**
     * Custom title for the picker dialog
     */
    pickerTitle?: string
}

/**
 * A unified media button that opens the MediaPicker dialog
 * for inserting images, videos, or audio from library or new uploads
 */
export const MediaButton = forwardRef<HTMLButtonElement, MediaButtonProps>(
    (
        {
            editor: providedEditor,
            text,
            allowedTypes,
            multiSelect = true,
            pickerTitle = "Add Media",
            children,
            ...buttonProps
        },
        ref
    ) => {
        const { editor } = useTiptapEditor(providedEditor)
        const [isPickerOpen, setIsPickerOpen] = useState(false)

        const { handleSelect } = useMediaPicker({
            editor,
            allowedTypes,
            multiSelect,
        })

        const handleClick = useCallback(
            (event: React.MouseEvent<HTMLButtonElement>) => {
                event.preventDefault()
                if (editor?.isEditable) {
                    setIsPickerOpen(true)
                }
            },
            [editor]
        )

        const handleSelectAndClose = useCallback(
            (items: Parameters<typeof handleSelect>[0]) => {
                handleSelect(items)
                setIsPickerOpen(false)
            },
            [handleSelect]
        )

        const isDisabled = !editor?.isEditable

        return (
            <>
                <Button
                    type="button"
                    data-style="ghost"
                    role="button"
                    tabIndex={-1}
                    disabled={isDisabled}
                    data-disabled={isDisabled}
                    aria-label={pickerTitle}
                    tooltip={pickerTitle}
                    onClick={handleClick}
                    {...buttonProps}
                    ref={ref}
                >
                    {children ?? (
                        <>
                            <ImagePlus className="tiptap-button-icon" />
                            {text && <span className="tiptap-button-text">{text}</span>}
                        </>
                    )}
                </Button>

                <MediaPicker
                    isOpen={isPickerOpen}
                    onClose={() => setIsPickerOpen(false)}
                    onSelect={handleSelectAndClose}
                    allowedTypes={allowedTypes}
                    multiSelect={multiSelect}
                    title={pickerTitle}
                />
            </>
        )
    }
)

MediaButton.displayName = "MediaButton"
