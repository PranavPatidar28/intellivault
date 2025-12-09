/**
 * Video Node Extension for TipTap
 * Renders embedded video players with controls
 */

import { mergeAttributes, Node } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { VideoNode as VideoNodeComponent } from "@/components/tiptap-node/video-node/video-node";

export interface VideoNodeOptions {
    /**
     * HTML attributes to add to the video element
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/react" {
    interface Commands<ReturnType> {
        video: {
            /**
             * Set a video node
             */
            setVideo: (options: { src: string; title?: string }) => ReturnType;
        };
    }
}

export const VideoNodeExtension = Node.create<VideoNodeOptions>({
    name: "video",

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
            title: {
                default: null,
            },
            width: {
                default: "100%",
            },
            height: {
                default: "auto",
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: "video[src]",
            },
            {
                tag: 'div[data-type="video"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            mergeAttributes({ "data-type": "video" }, this.options.HTMLAttributes),
            [
                "video",
                mergeAttributes(HTMLAttributes, {
                    controls: true,
                    preload: "metadata",
                }),
            ],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(VideoNodeComponent);
    },

    addCommands() {
        return {
            setVideo:
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

export default VideoNodeExtension;
