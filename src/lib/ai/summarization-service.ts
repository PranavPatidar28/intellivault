/**
 * AI Summarization Service
 *
 * Generates summaries and titles for notes using the Vercel AI SDK (via
 * ./generate). Includes caching via content hash, structured output for
 * title/keywords, and reasoning-aware streaming.
 */

import {
    genText,
    genObject,
    genTextStream,
    genFullStream,
    genMultimodal,
    type GenOptions,
    type MultimodalPart,
    type StreamPart,
} from "./generate";
import { summaryStructuredSchema } from "@/lib/validations/ai-dump";
import { createHash } from "crypto";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type SummaryLength = "short" | "medium" | "long";
export type SummaryStyle = "bullet" | "paragraph" | "tldr";

export interface SummarizationOptions {
    /** Target summary length */
    length?: SummaryLength;
    /** Summary format style */
    style?: SummaryStyle;
    /** Include extracted keywords */
    includeKeywords?: boolean;
    /** Also generate a title */
    generateTitle?: boolean;
    /** LLM options override */
    llmOptions?: GenOptions;
}

export interface SummarizationResult {
    /** Generated summary */
    summary: string;
    /** Auto-generated title (if requested) */
    generatedTitle?: string;
    /** Extracted keywords (if requested) */
    keywords?: string[];
    /** Confidence score (0-1) */
    confidence: number;
    /** Content hash for change detection */
    contentHash: string;
    /** LLM provider used */
    provider: string;
    /** Processing time in milliseconds */
    latencyMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

const LENGTH_CONFIG: Record<SummaryLength, { words: number; maxTokens: number }> = {
    short: { words: 50, maxTokens: 100 },
    medium: { words: 150, maxTokens: 300 },
    long: { words: 300, maxTokens: 500 },
};

const STYLE_INSTRUCTIONS: Record<SummaryStyle, string> = {
    bullet: `Format as **bullet points** using markdown:
- Start each point with a dash (-)
- Use 3-5 concise, actionable points
- Highlight **key terms** in bold
- Each bullet should be a complete thought
- Order by importance, most critical first`,
    paragraph: `Write as a **flowing paragraph**:
- Use clear, professional prose
- Start with the main conclusion or insight
- Connect ideas with smooth transitions
- Highlight **key concepts** in bold where appropriate
- End with implications or takeaways`,
    tldr: `Write a punchy **TL;DR** (one sentence):
- Capture the single most important insight
- Be direct and memorable
- Use active voice
- Maximum 25 words`,
};

const SYSTEM_PROMPT = `You are an expert note summarizer. Your summaries are:
- **Accurate**: Capture the core meaning without distortion
- **Concise**: Every word earns its place
- **Insightful**: Surface the "so what" - why this matters
- **Well-formatted**: Use markdown (bold, bullets) for readability

Write for someone who wants to quickly recall the essence of their note.`;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a hash of the content for change detection
 */
export function generateContentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Check if content has changed since last processing
 */
export function hasContentChanged(currentHash: string, storedHash?: string | null): boolean {
    return !storedHash || currentHash !== storedHash;
}

// ============================================================================
// Summarization Functions
// ============================================================================

/**
 * Generate a summary for note content. When a title or keywords are requested,
 * uses structured output (generateObject) instead of brittle JSON parsing.
 */
export async function generateSummary(
    content: string,
    options: SummarizationOptions = {}
): Promise<SummarizationResult> {
    const {
        length = "medium",
        style = "paragraph",
        includeKeywords = false,
        generateTitle = false,
        llmOptions = {},
    } = options;

    const contentHash = generateContentHash(content);
    const lengthConfig = LENGTH_CONFIG[length];
    const styleInstruction = STYLE_INSTRUCTIONS[style];
    const maxOutputTokens =
        lengthConfig.maxTokens + (generateTitle ? 50 : 0) + (includeKeywords ? 100 : 0);

    const truncatedContent = content.length > 8000 ? content.slice(0, 8000) + "..." : content;

    try {
        // Structured branch: ask for summary (+ title/keywords) as an object.
        if (generateTitle || includeKeywords) {
            const prompt = `Summarize the following content in approximately ${lengthConfig.words} words. ${styleInstruction}

Content:
${truncatedContent}

Provide the summary${generateTitle ? ", a concise title (5-10 words)" : ""}${includeKeywords ? ", and 3-7 relevant keywords" : ""}.`;

            const { object, provider, latencyMs } = await genObject(
                prompt,
                summaryStructuredSchema,
                {
                    ...llmOptions,
                    maxOutputTokens,
                    temperature: 0.3,
                    system: SYSTEM_PROMPT,
                }
            );

            return {
                summary: object.summary,
                generatedTitle: generateTitle ? object.title : undefined,
                keywords: includeKeywords ? object.keywords : undefined,
                confidence: calculateConfidence(content, object.summary),
                contentHash,
                provider,
                latencyMs,
            };
        }

        // Plain branch: just a formatted summary string.
        const prompt = `Summarize the following note in approximately ${lengthConfig.words} words.

${styleInstruction}

Content to summarize:
---
${truncatedContent}
---

Respond with ONLY the formatted summary. No preamble, no "Here's the summary", just the content.`;

        const result = await genText(prompt, {
            ...llmOptions,
            maxOutputTokens,
            temperature: 0.3,
            system: SYSTEM_PROMPT,
        });

        return {
            summary: result.text.trim(),
            confidence: calculateConfidence(content, result.text),
            contentHash,
            provider: result.provider,
            latencyMs: result.latencyMs,
        };
    } catch (error) {
        console.error("Summarization failed:", error);
        throw new Error(
            `Failed to generate summary: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

function buildStreamPrompt(content: string, length: SummaryLength, style: SummaryStyle): string {
    const lengthConfig = LENGTH_CONFIG[length];
    const styleInstruction = STYLE_INSTRUCTIONS[style];
    const truncatedContent = content.length > 8000 ? content.slice(0, 8000) + "..." : content;
    return `Summarize the following note in approximately ${lengthConfig.words} words.

${styleInstruction}

Content to summarize:
---
${truncatedContent}
---

Respond with ONLY the formatted summary. No preamble, no "Here's the summary", just the content.`;
}

/**
 * Stream a summary for note content. Yields text chunks only (no reasoning).
 */
export async function* generateSummaryStream(
    content: string,
    options: SummarizationOptions = {}
): AsyncGenerator<string, void, unknown> {
    const { length = "medium", style = "paragraph", llmOptions = {} } = options;
    const prompt = buildStreamPrompt(content, length, style);

    yield* genTextStream(prompt, {
        ...llmOptions,
        maxOutputTokens: LENGTH_CONFIG[length].maxTokens,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
    });
}

/**
 * Stream a summary, surfacing reasoning and text as tagged parts so the route
 * can emit reasoning separately and persist text-only content.
 */
export async function* generateSummaryStreamParts(
    content: string,
    options: SummarizationOptions = {}
): AsyncGenerator<StreamPart, void, unknown> {
    const { length = "medium", style = "paragraph", llmOptions = {} } = options;
    const prompt = buildStreamPrompt(content, length, style);

    yield* genFullStream(prompt, {
        ...llmOptions,
        maxOutputTokens: LENGTH_CONFIG[length].maxTokens,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
    });
}

/**
 * Generate a summary from multimodal content (text + images).
 */
export async function generateSummaryMultimodal(
    parts: MultimodalPart[],
    options: SummarizationOptions = {}
): Promise<SummarizationResult> {
    const { length = "medium", style = "paragraph", llmOptions = {} } = options;
    const lengthConfig = LENGTH_CONFIG[length];
    const styleInstruction = STYLE_INSTRUCTIONS[style];

    const textPrompt = `Analyze this note content (including any images) and summarize in approximately ${lengthConfig.words} words.

${styleInstruction}

If the note contains images, describe their key content and how they relate to the text.
If there is minimal text but meaningful images, focus on describing what the images show.

Respond with ONLY the formatted summary. No preamble, no "Here's the summary", just the content.`;

    const systemPrompt = `You are an expert note summarizer with vision capabilities. Your summaries are:
- **Accurate**: Capture the core meaning from both text AND images
- **Concise**: Every word earns its place
- **Insightful**: Surface the "so what" - why this matters
- **Well-formatted**: Use markdown (bold, bullets) for readability

When analyzing images, describe what you see accurately and how it relates to the note content.`;

    const contentParts: MultimodalPart[] = [
        { type: "text", text: textPrompt },
        ...parts,
    ];

    // Content hash from text parts only.
    const textContent = parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("\n");
    const imageCount = parts.filter((p) => p.type === "image").length;
    const contentHash = generateContentHash(`${textContent}|images:${imageCount}`);

    try {
        const response = await genMultimodal(contentParts, {
            ...llmOptions,
            maxOutputTokens: lengthConfig.maxTokens,
            temperature: 0.3,
            system: systemPrompt,
        });

        return {
            summary: response.text.trim(),
            confidence: calculateConfidence(textContent, response.text) * (imageCount > 0 ? 0.9 : 1),
            contentHash,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (error) {
        console.error("Multimodal summarization failed:", error);
        throw new Error(
            `Failed to generate multimodal summary: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

/**
 * Generate only a title for note content
 */
export async function generateTitle(
    content: string,
    llmOptions?: GenOptions
): Promise<{ title: string; provider: string }> {
    const prompt = `Analyze the following content and generate a concise, descriptive title (5-10 words max).

Content:
${content.slice(0, 2000)}

Respond with ONLY the title, no quotes or additional text.`;

    const response = await genText(prompt, {
        ...llmOptions,
        maxOutputTokens: 30,
        temperature: 0.5,
        system: "You are a title generator. Respond with only the title, nothing else.",
    });

    return {
        title: response.text.trim().replace(/^["']|["']$/g, ""),
        provider: response.provider,
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateConfidence(originalContent: string, summary: string): number {
    if (!summary || summary.length < 10) return 0.1;

    const compressionRatio = summary.length / originalContent.length;

    if (compressionRatio > 0.5) return 0.5; // Too long, might just be truncated
    if (compressionRatio < 0.01) return 0.4; // Too short

    // Check if summary is just the start of the content
    if (originalContent.toLowerCase().startsWith(summary.toLowerCase().slice(0, 50))) {
        return 0.4;
    }

    return 0.8;
}
