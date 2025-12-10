"use client"

import { forwardRef, useCallback } from "react"

// --- Lib ---
import { parseShortcutKeys } from "@/lib/tiptap-utils"

// --- Hooks ---
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Tiptap UI ---
import type { UseAudioUploadConfig } from "@/components/tiptap-ui/audio-upload-button/use-audio-upload"
import {
    AUDIO_UPLOAD_SHORTCUT_KEY,
    useAudioUpload,
} from "@/components/tiptap-ui/audio-upload-button/use-audio-upload"

// --- UI Primitives ---
import type { ButtonProps } from "@/components/tiptap-ui-primitive/button"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Badge } from "@/components/tiptap-ui-primitive/badge"

// --- Icons ---
import { Loader2 } from "lucide-react"

type IconProps = React.SVGProps<SVGSVGElement>
type IconComponent = ({ className, ...props }: IconProps) => React.ReactElement

export interface AudioUploadButtonProps
    extends Omit<ButtonProps, "type" | "onError">,
    UseAudioUploadConfig {
    /**
     * Optional text to display alongside the icon.
     */
    text?: string
    /**
     * Optional show shortcut keys in the button.
     * @default false
     */
    showShortcut?: boolean
    /**
     * Optional custom icon component to render instead of the default.
     */
    icon?: React.MemoExoticComponent<IconComponent> | React.FC<IconProps>
}

export function AudioShortcutBadge({
    shortcutKeys = AUDIO_UPLOAD_SHORTCUT_KEY,
}: {
    shortcutKeys?: string
}) {
    return <Badge>{parseShortcutKeys({ shortcutKeys })}</Badge>
}

/**
 * Button component for uploading audio in a Tiptap editor.
 */
export const AudioUploadButton = forwardRef<
    HTMLButtonElement,
    AudioUploadButtonProps
>(
    (
        {
            editor: providedEditor,
            text,
            hideWhenUnavailable = false,
            onInserted,
            onError,
            showShortcut = false,
            onClick,
            icon: CustomIcon,
            children,
            ...buttonProps
        },
        ref
    ) => {
        const { editor } = useTiptapEditor(providedEditor)
        const {
            isVisible,
            canInsert,
            isUploading,
            handleAudio,
            label,
            isActive,
            shortcutKeys,
            Icon,
        } = useAudioUpload({
            editor,
            hideWhenUnavailable,
            onInserted,
            onError,
        })

        const handleClick = useCallback(
            (event: React.MouseEvent<HTMLButtonElement>) => {
                onClick?.(event)
                if (event.defaultPrevented) return
                handleAudio()
            },
            [handleAudio, onClick]
        )

        if (!isVisible) {
            return null
        }

        const RenderIcon = isUploading ? Loader2 : (CustomIcon ?? Icon)

        return (
            <Button
                type="button"
                data-style="ghost"
                data-active-state={isActive ? "on" : "off"}
                role="button"
                tabIndex={-1}
                disabled={!canInsert || isUploading}
                data-disabled={!canInsert || isUploading}
                aria-label={isUploading ? "Uploading audio..." : label}
                aria-pressed={isActive}
                tooltip={isUploading ? "Uploading..." : label}
                onClick={handleClick}
                {...buttonProps}
                ref={ref}
            >
                {children ?? (
                    <>
                        <RenderIcon className={`tiptap-button-icon ${isUploading ? "animate-spin" : ""}`} />
                        {text && <span className="tiptap-button-text">{text}</span>}
                        {showShortcut && <AudioShortcutBadge shortcutKeys={shortcutKeys} />}
                    </>
                )}
            </Button>
        )
    }
)

AudioUploadButton.displayName = "AudioUploadButton"
