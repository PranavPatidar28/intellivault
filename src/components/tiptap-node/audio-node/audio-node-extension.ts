/**
 * Audio Node Extension for TipTap
 * Renders embedded audio players with controls
 */

import { mergeAttributes, Node } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { AudioNode as AudioNodeComponent } from "@/components/tiptap-node/audio-node/audio-node";

export interface AudioNodeOptions {
    /**
     * HTML attributes to add to the audio element
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/react" {
    interface Commands<ReturnType> {
        audio: {
            /**
             * Set an audio node
             */
            setAudio: (options: { src: string; title?: string }) => ReturnType;
        };
    }
}

export const AudioNodeExtension = Node.create<AudioNodeOptions>({
    name: "audio",

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
        };
    },

    parseHTML() {
        return [
            {
                tag: "audio[src]",
            },
            {
                tag: 'div[data-type="audio"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            "div",
            mergeAttributes({ "data-type": "audio" }, this.options.HTMLAttributes),
            [
                "audio",
                mergeAttributes(HTMLAttributes, {
                    controls: true,
                    preload: "metadata",
                }),
            ],
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AudioNodeComponent);
    },

    addCommands() {
        return {
            setAudio:
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

export default AudioNodeExtension;
