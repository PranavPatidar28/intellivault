/**
 * Video Node React Component for TipTap
 * Includes delete button to remove video from editor
 */

"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import "./video-node.scss";

export const VideoNode: React.FC<NodeViewProps> = ({ node, selected, deleteNode }) => {
    const { src, title } = node.attrs;

    // Extract filename from src if no title provided
    const displayTitle = title || (src ? src.split("/").pop()?.split("?")[0] : "Video file");

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNode();
    };

    return (
        <NodeViewWrapper
            className={`tiptap-video-node ${selected ? "selected" : ""}`}
            data-drag-handle
        >
            <div className="tiptap-video-container">
                <div className="tiptap-video-header">
                    <span className="tiptap-video-title">{displayTitle}</span>
                    <button
                        className="tiptap-video-delete"
                        onClick={handleDelete}
                        title="Remove video"
                        type="button"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
                <video
                    src={src}
                    title={title}
                    controls
                    preload="metadata"
                    className="tiptap-video-player"
                >
                    Your browser does not support the video tag.
                </video>
            </div>
        </NodeViewWrapper>
    );
};

export default VideoNode;
