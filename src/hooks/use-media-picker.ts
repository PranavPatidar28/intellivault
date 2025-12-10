"use client"

import { useState, useCallback } from "react"
import type { Editor } from "@tiptap/react"
import type { MediaItem } from "@/hooks/use-media"
import { FileType } from "@/generated/prisma/client"

export interface UseMediaPickerConfig {
    editor: Editor | null
    allowedTypes?: FileType[]
    multiSelect?: boolean
}

export interface UseMediaPickerReturn {
    isOpen: boolean
    open: () => void
    close: () => void
    handleSelect: (items: MediaItem[]) => void
    allowedTypes?: FileType[]
    multiSelect: boolean
}

export function useMediaPicker(config: UseMediaPickerConfig): UseMediaPickerReturn {
    const { editor, allowedTypes, multiSelect = true } = config
    const [isOpen, setIsOpen] = useState(false)

    const open = useCallback(() => {
        if (editor?.isEditable) {
            setIsOpen(true)
        }
    }, [editor])

    const close = useCallback(() => {
        setIsOpen(false)
    }, [])

    const handleSelect = useCallback((items: MediaItem[]) => {
        if (!editor || !items.length) return

        const nodes = items.map((item) => {
            switch (item.fileType) {
                case "IMAGE":
                    return {
                        type: "image",
                        attrs: {
                            src: item.url,
                            alt: item.filename,
                            title: item.filename,
                        },
                    }
                case "VIDEO":
                    return {
                        type: "video",
                        attrs: {
                            src: item.url,
                            title: item.filename,
                        },
                    }
                case "AUDIO":
                    return {
                        type: "audio",
                        attrs: {
                            src: item.url,
                            title: item.filename,
                        },
                    }
                default:
                    return null
            }
        }).filter(Boolean)

        if (nodes.length > 0) {
            editor.chain().focus().insertContent(nodes).run()
        }
    }, [editor])

    return {
        isOpen,
        open,
        close,
        handleSelect,
        allowedTypes,
        multiSelect,
    }
}
