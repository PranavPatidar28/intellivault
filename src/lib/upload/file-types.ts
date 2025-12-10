/**
 * File type definitions and validation utilities for media uploads
 */

export type FileCategory = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

interface FileTypeConfig {
    mimeTypes: string[];
    extensions: string[];
    maxSize: number;
    accept: string;
}

/**
 * Configuration for supported file types and their constraints
 */
export const FILE_TYPE_CONFIG: Record<FileCategory, FileTypeConfig> = {
    IMAGE: {
        mimeTypes: [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
        ],
        extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
        maxSize: 5 * 1024 * 1024, // 5MB
        accept: "image/*",
    },
    VIDEO: {
        mimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
        extensions: [".mp4", ".webm", ".mov"],
        maxSize: 20 * 1024 * 1024, // 20MB
        accept: "video/*",
    },
    AUDIO: {
        mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
        extensions: [".mp3", ".wav", ".ogg", ".webm"],
        maxSize: 20 * 1024 * 1024, // 20MB
        accept: "audio/*",
    },
    DOCUMENT: {
        mimeTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/markdown",
        ],
        extensions: [".pdf", ".doc", ".docx", ".txt", ".md"],
        maxSize: 10 * 1024 * 1024, // 10MB
        accept: ".pdf,.doc,.docx,.txt,.md",
    },
};

/**
 * All supported MIME types across all categories
 */
export const ALL_SUPPORTED_MIME_TYPES = Object.values(FILE_TYPE_CONFIG).flatMap(
    (config) => config.mimeTypes
);

/**
 * Get the file category for a given MIME type
 * @throws Error if MIME type is not supported
 */
export function getFileCategory(mimeType: string): FileCategory {
    for (const [category, config] of Object.entries(FILE_TYPE_CONFIG)) {
        if (config.mimeTypes.includes(mimeType)) {
            return category as FileCategory;
        }
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Check if a MIME type is supported
 */
export function isSupportedMimeType(mimeType: string): boolean {
    return ALL_SUPPORTED_MIME_TYPES.includes(mimeType);
}

/**
 * Get the maximum file size for a given category in bytes
 */
export function getMaxFileSize(category: FileCategory): number {
    return FILE_TYPE_CONFIG[category].maxSize;
}

/**
 * Format file size for display (e.g., "5.2 MB")
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Validate a file against category constraints
 * @returns Object with isValid boolean and optional error message
 */
export function validateFile(
    file: File,
    category?: FileCategory
): { isValid: boolean; error?: string } {
    // Check if MIME type is supported
    if (!isSupportedMimeType(file.type)) {
        return {
            isValid: false,
            error: `File type "${file.type}" is not supported. Supported types: images, videos, audio, and documents.`,
        };
    }

    // Determine category if not provided
    const fileCategory = category ?? getFileCategory(file.type);
    const config = FILE_TYPE_CONFIG[fileCategory];

    // Check file size
    if (file.size > config.maxSize) {
        return {
            isValid: false,
            error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(config.maxSize)}) for ${fileCategory.toLowerCase()} files.`,
        };
    }

    return { isValid: true };
}

/**
 * Get the accept string for file input elements
 * @param categories - Optional array of categories to include. If not provided, includes all.
 */
export function getAcceptString(categories?: FileCategory[]): string {
    const cats = categories ?? (Object.keys(FILE_TYPE_CONFIG) as FileCategory[]);
    return cats.map((cat) => FILE_TYPE_CONFIG[cat].accept).join(",");
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : "";
}

/**
 * Generate a unique filename for blob storage
 */
export function generateBlobPathname(
    originalFilename: string,
    userId: string
): string {
    const ext = getFileExtension(originalFilename);
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    return `uploads/${userId}/${timestamp}-${randomId}${ext}`;
}
