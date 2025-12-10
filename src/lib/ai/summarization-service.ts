/**
 * AI Summarization Service
 *
 * Generates summaries and titles for notes using LLM providers.
 * Includes caching via content hash to avoid re-processing unchanged notes.
 * Supports multimodal (text + images) summarization.
 */

import { generateText, streamText, generateMultimodal, type LLMOptions, type MultimodalPart } from "./llm-provider";
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
    llmOptions?: LLMOptions;
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
 * Generate a summary for note content
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

    // Build the prompt
    const prompt = buildSummarizationPrompt(content, {
        targetWords: lengthConfig.words,
        styleInstruction,
        includeKeywords,
        generateTitle,
    });

    const systemPrompt = `You are an expert note summarizer. Your summaries are:
        - **Accurate**: Capture the core meaning without distortion
        - **Concise**: Every word earns its place  
        - **Insightful**: Surface the \"so what\" - why this matters
        - **Well-formatted**: Use markdown (bold, bullets) for readability
    
        Write for someone who wants to quickly recall the essence of their note. Always respond with valid JSON when structured output is requested.`;

    try {
        const response = await generateText(prompt, {
            ...llmOptions,
            maxTokens: lengthConfig.maxTokens + (generateTitle ? 50 : 0) + (includeKeywords ? 100 : 0),
            temperature: 0.3, // Lower temperature for more consistent summaries
            systemPrompt,
        });

        // Parse the response
        const parsed = parseResponse(response.text, { includeKeywords, generateTitle });

        return {
            summary: parsed.summary,
            generatedTitle: parsed.title,
            keywords: parsed.keywords,
            confidence: calculateConfidence(content, parsed.summary),
            contentHash,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (error) {
        console.error("Summarization failed:", error);
        throw new Error(
            `Failed to generate summary: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

/**
 * Stream a summary for note content
 * Yields text chunks as they arrive from the LLM
 */
export async function* generateSummaryStream(
    content: string,
    options: SummarizationOptions = {}
): AsyncGenerator<string, void, unknown> {
    const {
        length = "medium",
        style = "paragraph",
        llmOptions = {},
    } = options;

    const lengthConfig = LENGTH_CONFIG[length];
    const styleInstruction = STYLE_INSTRUCTIONS[style];

    // Build the prompt (simpler, no JSON for streaming)
    const truncatedContent = content.length > 8000 ? content.slice(0, 8000) + "..." : content;
    const prompt = `Summarize the following note in approximately ${lengthConfig.words} words.

${styleInstruction}

Content to summarize:
---
${truncatedContent}
---

Respond with ONLY the formatted summary. No preamble, no "Here's the summary", just the content.`;

    const systemPrompt = `You are an expert note summarizer. Your summaries are:
- **Accurate**: Capture the core meaning without distortion
- **Concise**: Every word earns its place
- **Insightful**: Surface the "so what" - why this matters
- **Well-formatted**: Use markdown (bold, bullets) for readability

Write for someone who wants to quickly recall the essence of their note.`;

    yield* streamText(prompt, {
        ...llmOptions,
        maxTokens: lengthConfig.maxTokens,
        temperature: 0.3,
        systemPrompt,
    });
}

/**
 * Generate a summary from multimodal content (text + images)
 * Uses vision-capable models like Gemini or Claude
 */
export async function generateSummaryMultimodal(
    parts: MultimodalPart[],
    options: SummarizationOptions = {}
): Promise<SummarizationResult> {
    const {
        length = "medium",
        style = "paragraph",
        llmOptions = {},
    } = options;

    const lengthConfig = LENGTH_CONFIG[length];
    const styleInstruction = STYLE_INSTRUCTIONS[style];

    // Build the text prompt
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

    // Prepend the instruction to the parts
    const contentParts: MultimodalPart[] = [
        { type: "text", text: textPrompt },
        ...parts,
    ];

    // Generate content hash from text parts only
    const textContent = parts
        .filter(p => p.type === "text" && p.text)
        .map(p => p.text)
        .join("\n");
    const imageCount = parts.filter(p => p.type === "image").length;
    const contentHash = generateContentHash(`${textContent}|images:${imageCount}`);

    const startTime = Date.now();

    try {
        const response = await generateMultimodal(contentParts, {
            ...llmOptions,
            maxTokens: lengthConfig.maxTokens,
            temperature: 0.3,
            systemPrompt,
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
    llmOptions?: LLMOptions
): Promise<{ title: string; provider: string }> {
    const prompt = `Analyze the following content and generate a concise, descriptive title (5-10 words max).

Content:
${content.slice(0, 2000)}

Respond with ONLY the title, no quotes or additional text.`;

    const response = await generateText(prompt, {
        ...llmOptions,
        maxTokens: 30,
        temperature: 0.5,
        systemPrompt: "You are a title generator. Respond with only the title, nothing else.",
    });

    return {
        title: response.text.trim().replace(/^["']|["']$/g, ""),
        provider: response.provider,
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface PromptOptions {
    targetWords: number;
    styleInstruction: string;
    includeKeywords: boolean;
    generateTitle: boolean;
}

function buildSummarizationPrompt(content: string, options: PromptOptions): string {
    const { targetWords, styleInstruction, includeKeywords, generateTitle } = options;

    // Truncate very long content to avoid token limits
    const truncatedContent = content.length > 8000 ? content.slice(0, 8000) + "..." : content;

    let prompt = `Summarize the following content in approximately ${targetWords} words. ${styleInstruction}

Content:
${truncatedContent}

`;

    if (generateTitle || includeKeywords) {
        prompt += `Respond with a JSON object containing:
- "summary": the summary text
`;
        if (generateTitle) {
            prompt += `- "title": a concise title (5-10 words)
`;
        }
        if (includeKeywords) {
            prompt += `- "keywords": an array of 3-7 relevant keywords
`;
        }
        prompt += `
Example format:
{
  "summary": "Your summary here..."${generateTitle ? ',\n  "title": "Descriptive Title"' : ""}${includeKeywords ? ',\n  "keywords": ["keyword1", "keyword2"]' : ""}
}`;
    } else {
        prompt += `Respond with ONLY the summary text, no JSON or additional formatting.`;
    }

    return prompt;
}

interface ParsedResponse {
    summary: string;
    title?: string;
    keywords?: string[];
}

function parseResponse(
    responseText: string,
    options: { includeKeywords: boolean; generateTitle: boolean }
): ParsedResponse {
    const { includeKeywords, generateTitle } = options;

    // If we don't need structured data, just return the text
    if (!includeKeywords && !generateTitle) {
        return { summary: responseText.trim() };
    }

    // Try to parse as JSON
    try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
            responseText.match(/(\{[\s\S]*\})/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            return {
                summary: parsed.summary || responseText,
                title: generateTitle ? parsed.title : undefined,
                keywords: includeKeywords ? parsed.keywords : undefined,
            };
        }
    } catch {
        // JSON parsing failed, extract what we can
    }

    // Fallback: return the response as summary
    return { summary: responseText.trim() };
}

function calculateConfidence(originalContent: string, summary: string): number {
    // Simple confidence calculation based on:
    // 1. Summary length relative to original
    // 2. Summary not being empty
    // 3. Summary not being too similar to original (just truncated)

    if (!summary || summary.length < 10) return 0.1;

    const compressionRatio = summary.length / originalContent.length;

    // Good compression is between 5% and 50%
    if (compressionRatio > 0.5) return 0.5; // Too long, might just be truncated
    if (compressionRatio < 0.01) return 0.4; // Too short

    // Check if summary is just the start of the content
    if (originalContent.toLowerCase().startsWith(summary.toLowerCase().slice(0, 50))) {
        return 0.4;
    }

    return 0.8;
}
