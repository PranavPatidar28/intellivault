/**
 * File Attachment Node Extension for TipTap
 * Renders document attachments with download functionality
 */

import { mergeAttributes, Node } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { FileAttachmentNode as FileAttachmentNodeComponent } from "@/components/tiptap-node/file-attachment-node/file-attachment-node";

export interface FileAttachmentNodeOptions {
    /**
     * HTML attributes to add to the attachment element
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/react" {
    interface Commands<ReturnType> {
        fileAttachment: {
            /**
             * Set a file attachment node
             */
            setFileAttachment: (options: {
                src: string;
                filename: string;
                size?: number;
                mimeType?: string;
            }) => ReturnType;
        };
    }
}

export const FileAttachmentNodeExtension = Node.create<FileAttachmentNodeOptions>({
    name: "fileAttachment",

    group: "block",

    draggable: true,

    selectable: true,

    atom: true,

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            src: {
                default: null,
            },
            filename: {
                default: "document",
            },
            size: {
                default: 0,
            },
            mimeType: {
                default: "application/octet-stream",
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="file-attachment"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            mergeAttributes(
                { "data-type": "file-attachment" },
                this.options.HTMLAttributes,
                HTMLAttributes
            ),
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(FileAttachmentNodeComponent);
    },

    addCommands() {
        return {
            setFileAttachment:
                (options) =>
                    ({ commands }) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: options,
                        });
                    },
        };
    },
});

export default FileAttachmentNodeExtension;
