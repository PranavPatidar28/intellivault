/**
 * Custom Image Node React Component for TipTap
 * Includes delete button to remove image from editor
 */

"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Trash2 } from "lucide-react";
import "./image-node.scss";

export const ImageNode: React.FC<NodeViewProps> = ({ node, selected, deleteNode }) => {
    const { src, alt, title } = node.attrs;

    // Use alt or title or extract filename from src
    const displayTitle = alt || title || (src ? src.split("/").pop()?.split("?")[0] : "Image");

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        deleteNode();
    };

    return (
        <NodeViewWrapper
            className={`tiptap-image-node ${selected ? "selected" : ""}`}
            data-drag-handle
        >
            <div className="tiptap-image-container">
                <img
                    src={src}
                    alt={alt || displayTitle}
                    title={title}
                    className="tiptap-image-element"
                />
                <button
                    className="tiptap-image-delete"
                    onClick={handleDelete}
                    title="Remove image"
                    type="button"
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </NodeViewWrapper>
    );
};

export default ImageNode;
