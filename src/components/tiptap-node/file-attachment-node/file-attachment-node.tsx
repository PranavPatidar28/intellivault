/**
 * File Attachment Node React Component for TipTap
 */

"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { FileText, File, Download, FileSpreadsheet, FileCode } from "lucide-react";
import "./file-attachment-node.scss";

/**
 * Get appropriate icon based on MIME type
 */
function getFileIcon(mimeType: string) {
    if (mimeType === "application/pdf") {
        return FileText;
    }
    if (
        mimeType === "application/msword" ||
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        return FileText;
    }
    if (mimeType === "text/plain") {
        return FileCode;
    }
    if (mimeType === "text/markdown") {
        return FileCode;
    }
    if (mimeType.startsWith("application/vnd.ms-excel") || mimeType.includes("spreadsheet")) {
        return FileSpreadsheet;
    }
    return File;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot !== -1 ? filename.slice(lastDot + 1).toUpperCase() : "";
}

export const FileAttachmentNode: React.FC<NodeViewProps> = ({
    node,
    selected,
}) => {
    const { src, filename, size, mimeType } = node.attrs;
    const FileIcon = getFileIcon(mimeType);
    const extension = getFileExtension(filename);

    const handleDownload = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Open in new tab or trigger download
        const link = document.createElement("a");
        link.href = src;
        link.download = filename;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <NodeViewWrapper
            className={`tiptap-file-attachment-node ${selected ? "selected" : ""}`}
            data-drag-handle
        >
            <div className="tiptap-file-attachment-container">
                <div className="tiptap-file-attachment-icon-wrapper">
                    <FileIcon className="tiptap-file-attachment-icon" size={24} />
                    {extension && (
                        <span className="tiptap-file-attachment-extension">{extension}</span>
                    )}
                </div>
                <div className="tiptap-file-attachment-info">
                    <span className="tiptap-file-attachment-name" title={filename}>
                        {filename}
                    </span>
                    {size > 0 && (
                        <span className="tiptap-file-attachment-size">
                            {formatFileSize(size)}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    className="tiptap-file-attachment-download"
                    onClick={handleDownload}
                    title="Download file"
                >
                    <Download size={18} />
                </button>
            </div>
        </NodeViewWrapper>
    );
};

export default FileAttachmentNode;
