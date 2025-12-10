/**
 * Custom Image Node Extension for TipTap
 * Uses React component for rendering with delete button
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNode } from "./image-node";

export interface CustomImageOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        customImage: {
            setCustomImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
        };
    }
}

export const CustomImageExtension = Node.create<CustomImageOptions>({
    name: "image",

    group: "block",

    atom: true,

    draggable: true,

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
            alt: {
                default: null,
            },
            title: {
                default: null,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: "img[src]:not([data-upload])",
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(ImageNode);
    },

    addCommands() {
        return {
            setCustomImage:
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

export default CustomImageExtension;
