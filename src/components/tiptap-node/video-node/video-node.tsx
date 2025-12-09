/**
 * Video Node React Component for TipTap
 */

"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import "./video-node.scss";

export const VideoNode: React.FC<NodeViewProps> = ({ node, selected }) => {
    const { src, title } = node.attrs;

    return (
        <NodeViewWrapper
            className={`tiptap-video-node ${selected ? "selected" : ""}`}
            data-drag-handle
        >
            <div className="tiptap-video-container">
                <video
                    src={src}
                    title={title}
                    controls
                    preload="metadata"
                    className="tiptap-video-player"
                >
                    Your browser does not support the video tag.
                </video>
                {title && <span className="tiptap-video-title">{title}</span>}
            </div>
        </NodeViewWrapper>
    );
};

export default VideoNode;
