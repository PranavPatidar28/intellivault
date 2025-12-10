/**
 * Audio Node React Component for TipTap
 * Includes delete button to remove audio from editor
 */

"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Music, Trash2 } from "lucide-react";
import "./audio-node.scss";

export const AudioNode: React.FC<NodeViewProps> = ({ node, selected, deleteNode }) => {
    const { src, title } = node.attrs;

    // Extract filename from src if no title provided
    const displayTitle = title || (src ? src.split("/").pop()?.split("?")[0] : "Audio file");

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNode();
    };

    return (
        <NodeViewWrapper
            className={`tiptap-audio-node ${selected ? "selected" : ""}`}
            data-drag-handle
        >
            <div className="tiptap-audio-container">
                <div className="tiptap-audio-header">
                    <Music className="tiptap-audio-icon" size={20} />
                    <span className="tiptap-audio-title">{displayTitle}</span>
                    <button
                        className="tiptap-audio-delete"
                        onClick={handleDelete}
                        title="Remove audio"
                        type="button"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                <audio
                    src={src}
                    controls
                    preload="metadata"
                    className="tiptap-audio-player"
                >
                    Your browser does not support the audio element.
                </audio>
            </div>
        </NodeViewWrapper>
    );
};

export default AudioNode;
