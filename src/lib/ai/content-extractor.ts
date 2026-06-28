/**
 * Content Extraction Utilities
 *
 * Extracts structured content (text, images, videos, audio) from TipTap JSON.
 * Used for preparing multimodal input for AI summarization.
 */

import type { JSONContent } from "@tiptap/core";
import { safeFetchImage } from "./safe-fetch";

// ============================================================================
// Types
// ============================================================================

export interface ExtractedImage {
    url: string;
    alt?: string;
    title?: string;
}

export interface ExtractedVideo {
    url: string;
    title?: string;
}

export interface ExtractedAudio {
    url: string;
    title?: string;
}

export interface ExtractedContent {
    /** Plain text content (paragraphs, headings, lists) */
    text: string;
    /** Extracted image sources */
    images: ExtractedImage[];
    /** Extracted video sources */
    videos: ExtractedVideo[];
    /** Extracted audio sources */
    audio: ExtractedAudio[];
    /** Whether the note contains any media */
    hasMedia: boolean;
    /** Approximate word count of text */
    wordCount: number;
    /** Total number of media items */
    mediaCount: number;
}

export interface MultimodalPart {
    type: "text" | "image";
    text?: string;
    imageUrl?: string;
    base64Data?: string;
    mimeType?: string;
}

export interface ContextOptions {
    /** Include text content (default: true) */
    includeText?: boolean;
    /** Include images (default: false) */
    includeImages?: boolean;
    /** Maximum images to include (default: 5) */
    maxImages?: number;
    /** Include note title in text (default: true) */
    includeTitle?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_IMAGES = 5;
const MIN_TEXT_LENGTH_FOR_SUMMARY = 50; // Minimum characters needed

// ============================================================================
// Content Extraction
// ============================================================================

/**
 * Extract structured content from TipTap JSON document
 */
export function extractContentFromJSON(contentJSON: JSONContent): ExtractedContent {
    const result: ExtractedContent = {
        text: "",
        images: [],
        videos: [],
        audio: [],
        hasMedia: false,
        wordCount: 0,
        mediaCount: 0,
    };

    const textParts: string[] = [];

    function traverse(node: JSONContent): void {
        if (!node) return;

        // Handle text nodes
        if (node.type === "text" && node.text) {
            textParts.push(node.text);
        }

        // Handle paragraph, heading, listItem - add newline after
        if (["paragraph", "heading", "listItem", "taskItem"].includes(node.type || "")) {
            if (node.content) {
                node.content.forEach(traverse);
            }
            textParts.push("\n");
            return;
        }

        // Handle image nodes
        if (node.type === "image" || node.type === "customImage") {
            const attrs = node.attrs || {};
            if (attrs.src) {
                result.images.push({
                    url: attrs.src,
                    alt: attrs.alt,
                    title: attrs.title,
                });
            }
        }

        // Handle video nodes
        if (node.type === "video") {
            const attrs = node.attrs || {};
            if (attrs.src) {
                result.videos.push({
                    url: attrs.src,
                    title: attrs.title,
                });
            }
        }

        // Handle audio nodes
        if (node.type === "audio") {
            const attrs = node.attrs || {};
            if (attrs.src) {
                result.audio.push({
                    url: attrs.src,
                    title: attrs.title,
                });
            }
        }

        // Recurse into children
        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(traverse);
        }
    }

    traverse(contentJSON);

    // Clean up text
    result.text = textParts
        .join("")
        .replace(/\n{3,}/g, "\n\n") // Collapse multiple newlines
        .trim();

    result.wordCount = result.text.split(/\s+/).filter(Boolean).length;
    result.mediaCount = result.images.length + result.videos.length + result.audio.length;
    result.hasMedia = result.mediaCount > 0;

    return result;
}

// ============================================================================
// Content Validation
// ============================================================================

export interface ContentValidation {
    /** Whether the content can be summarized */
    canSummarize: boolean;
    /** Validation message for user feedback */
    message: string;
    /** Suggestion for the user */
    suggestion?: string;
    /** Whether multimodal mode would help */
    suggestMultimodal: boolean;
}

/**
 * Validate if content is sufficient for summarization
 */
export function validateContentForSummary(
    extracted: ExtractedContent,
    options: ContextOptions = {}
): ContentValidation {
    const { includeImages = false } = options;

    // Case 1: Has sufficient text
    if (extracted.text.length >= MIN_TEXT_LENGTH_FOR_SUMMARY) {
        return {
            canSummarize: true,
            message: "Content is ready for summarization.",
            suggestMultimodal: false,
        };
    }

    // Case 2: Has images but includeImages is off
    if (extracted.images.length > 0 && !includeImages) {
        return {
            canSummarize: false,
            message: "This note contains only images with minimal text.",
            suggestion: "Enable 'Include images' to analyze the visual content.",
            suggestMultimodal: true,
        };
    }

    // Case 3: Has images and includeImages is on
    if (extracted.images.length > 0 && includeImages) {
        return {
            canSummarize: true,
            message: "Will analyze images to generate summary.",
            suggestMultimodal: true,
        };
    }

    // Case 4: No content at all
    if (extracted.text.length === 0 && !extracted.hasMedia) {
        return {
            canSummarize: false,
            message: "This note is empty.",
            suggestMultimodal: false,
        };
    }

    // Case 5: Only has video/audio (no image support yet)
    if (extracted.videos.length > 0 || extracted.audio.length > 0) {
        return {
            canSummarize: false,
            message: "Video and audio summarization is not yet supported.",
            suggestion: "Add text content to enable summarization.",
            suggestMultimodal: false,
        };
    }

    // Case 6: Very short text
    return {
        canSummarize: false,
        message: "Not enough content to generate a meaningful summary.",
        suggestion: `Add at least ${MIN_TEXT_LENGTH_FOR_SUMMARY} characters of text.`,
        suggestMultimodal: false,
    };
}

// ============================================================================
// Multimodal Content Preparation
// ============================================================================

/**
 * Fetch image and convert to base64.
 *
 * Image URLs originate from user-authored note content, so the fetch is
 * routed through safeFetchImage which blocks SSRF vectors (internal hosts,
 * cloud metadata, redirects) and bounds time + size. Returns null on any
 * failure or rejected URL so summarization degrades gracefully.
 */
export async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
    try {
        const { buffer, mimeType } = await safeFetchImage(url);
        return { base64: buffer.toString("base64"), mimeType };
    } catch (error) {
        console.warn(`Skipping image (unsafe or unreachable) ${url}:`, error instanceof Error ? error.message : error);
        return null;
    }
}

/**
 * Prepare multimodal content for LLM input
 */
export async function prepareMultimodalContent(
    extracted: ExtractedContent,
    title: string,
    options: ContextOptions = {}
): Promise<MultimodalPart[]> {
    const {
        includeText = true,
        includeImages = false,
        maxImages = DEFAULT_MAX_IMAGES,
        includeTitle = true,
    } = options;

    const parts: MultimodalPart[] = [];

    // Add text content
    if (includeText) {
        let textContent = "";
        if (includeTitle && title) {
            textContent = `Title: ${title}\n\n`;
        }
        textContent += extracted.text;

        if (textContent.trim()) {
            parts.push({
                type: "text",
                text: textContent.trim(),
            });
        }
    }

    // Add images (up to maxImages)
    if (includeImages && extracted.images.length > 0) {
        const imagesToProcess = extracted.images.slice(0, maxImages);

        for (const img of imagesToProcess) {
            const imageData = await fetchImageAsBase64(img.url);
            if (imageData) {
                parts.push({
                    type: "image",
                    base64Data: imageData.base64,
                    mimeType: imageData.mimeType,
                });
            }
        }
    }

    return parts;
}

/**
 * Check if we need multimodal processing
 */
export function needsMultimodalProcessing(
    extracted: ExtractedContent,
    options: ContextOptions
): boolean {
    const { includeImages = false } = options;
    return includeImages && extracted.images.length > 0;
}
