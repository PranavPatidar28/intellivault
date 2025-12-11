/**
 * useFileUpload Hook
 * 
 * Handles file upload and processing for AI Dump.
 * Supports drag & drop, click to upload, and file type validation.
 */

"use client";

import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

// Supported file types
export const SUPPORTED_FILE_TYPES = {
    "text/plain": { ext: ".txt", label: "Text" },
    "text/markdown": { ext: ".md", label: "Markdown" },
    "application/pdf": { ext: ".pdf", label: "PDF" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
        ext: ".docx",
        label: "Word",
    },
    "image/png": { ext: ".png", label: "Image" },
    "image/jpeg": { ext: ".jpg", label: "Image" },
    "image/webp": { ext: ".webp", label: "Image" },
    "image/gif": { ext: ".gif", label: "Image" },
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_FILE_TYPES;

export interface ProcessedFile {
    type: "text" | "markdown" | "pdf" | "docx" | "image";
    text: string;
    imageData?: string;
    metadata: {
        filename: string;
        mimeType: string;
        size: number;
        pageCount?: number;
    };
}

interface UseFileUploadReturn {
    // State
    isDragging: boolean;
    isUploading: boolean;
    uploadProgress: number;
    uploadError: string | null;
    processedFile: ProcessedFile | null;

    // Handlers
    handleDragEnter: (e: React.DragEvent) => void;
    handleDragLeave: (e: React.DragEvent) => void;
    handleDragOver: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent) => void;
    handleFileSelect: (file: File) => Promise<void>;
    openFilePicker: () => void;
    clearFile: () => void;

    // Refs
    fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useFileUpload(): UseFileUploadReturn {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [processedFile, setProcessedFile] = useState<ProcessedFile | null>(null);

    const validateFile = useCallback((file: File): boolean => {
        // Check file type
        if (!(file.type in SUPPORTED_FILE_TYPES)) {
            setUploadError(`Unsupported file type: ${file.type || "unknown"}`);
            toast({
                title: "Unsupported file type",
                description: "Please upload a text, PDF, DOCX, or image file.",
                variant: "destructive",
            });
            return false;
        }

        // Check file size (max 10MB)
        const MAX_SIZE = 10 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            setUploadError("File too large. Maximum size is 10MB.");
            toast({
                title: "File too large",
                description: "Maximum file size is 10MB.",
                variant: "destructive",
            });
            return false;
        }

        return true;
    }, [toast]);

    const handleFileSelect = useCallback(async (file: File) => {
        if (!validateFile(file)) return;

        setIsUploading(true);
        setUploadProgress(0);
        setUploadError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            // Simulate progress for better UX
            const progressInterval = setInterval(() => {
                setUploadProgress((prev) => Math.min(prev + 10, 90));
            }, 100);

            const response = await fetch("/api/ai-dump/upload", {
                method: "POST",
                body: formData,
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Upload failed");
            }

            const data = await response.json();

            setProcessedFile({
                type: data.type,
                text: data.text,
                imageData: data.imageData,
                metadata: data.metadata,
            });

            toast({
                title: "File processed",
                description: `${data.metadata.filename} ready for AI Dump`,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Upload failed";
            setUploadError(message);
            toast({
                title: "Upload failed",
                description: message,
                variant: "destructive",
            });
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    }, [validateFile, toast]);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if we're leaving the drop zone entirely
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, [handleFileSelect]);

    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const clearFile = useCallback(() => {
        setProcessedFile(null);
        setUploadError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, []);

    return {
        isDragging,
        isUploading,
        uploadProgress,
        uploadError,
        processedFile,
        handleDragEnter,
        handleDragLeave,
        handleDragOver,
        handleDrop,
        handleFileSelect,
        openFilePicker,
        clearFile,
        fileInputRef,
    };
}
