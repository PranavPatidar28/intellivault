/**
 * AI Dump Service
 *
 * Orchestrates the AI Dump pipeline: ingests raw content and generates
 * structured output with titles, tags, TL;DR, markdown, and action items.
 * Leverages existing llm-provider.ts for multi-provider support.
 */

import { generateText, streamText, type LLMOptions } from "./llm-provider";
import { suggestTags } from "./auto-tagging-service";
import { chunkText } from "./chunker";
import { PROMPTS, getPromptId, getPromptSnapshot } from "./ai-dump-prompts";
import type {
    AIDumpOptions,
    AIDumpResult,
    TitleVariant,
    TagWithConfidence,
    ActionItem,
    Provenance,
    AIDumpTone,
} from "@/lib/validations/ai-dump";

// ============================================================================
// Constants
// ============================================================================

const MAX_CONTENT_LENGTH = 50000; // Max characters before chunking
const CHUNK_SIZE = 4000;
const MIN_CONTENT_LENGTH = 10;

// ============================================================================
// Main Processing Functions
// ============================================================================

/**
 * Process content through the full AI Dump pipeline
 */
export async function processAIDump(
    content: string,
    userId: string,
    options: AIDumpOptions
): Promise<AIDumpResult> {
    const startTime = Date.now();

    // Validate content
    if (!content || content.trim().length < MIN_CONTENT_LENGTH) {
        throw new Error("Content is too short for processing");
    }

    // Truncate if too long (for now, future: hierarchical chunking)
    const processedContent =
        content.length > MAX_CONTENT_LENGTH
            ? content.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated...]"
            : content;

    // Run generation tasks based on toggles
    const results = await Promise.allSettled([
        options.toggles.titles
            ? generateTitleTagsTldr(processedContent, options.tone)
            : Promise.resolve(null),
        options.toggles.markdown
            ? generateStructuredMarkdown(processedContent, options)
            : Promise.resolve(null),
        options.toggles.actions
            ? extractActions(processedContent)
            : Promise.resolve([]),
        generateSummary(processedContent, options.tone),
    ]);

    // Extract results with fallbacks
    const titleTagsTldr =
        results[0].status === "fulfilled" ? results[0].value : null;
    const markdown =
        results[1].status === "fulfilled" ? results[1].value : processedContent;
    const actions = results[2].status === "fulfilled" ? results[2].value : [];
    const summary =
        results[3].status === "fulfilled"
            ? results[3].value
            : "Summary generation failed";

    // If title/tags generation failed, try to get tags from existing service
    let tags: TagWithConfidence[] = titleTagsTldr?.tags ?? [];
    if (options.toggles.tags && tags.length === 0) {
        try {
            const tagResult = await suggestTags(processedContent, userId, {
                maxSuggestions: 5,
            });
            tags = tagResult.suggestions.map((s) => ({
                name: s.name,
                confidence: s.confidence,
            }));
        } catch {
            tags = [];
        }
    }

    const provenance: Provenance = {
        llm_model: "gemini-2.0-flash", // Will be updated by actual provider
        prompt_template_id: getPromptId("TITLE_TAGS_TLDR"),
        temperature: options.temperature,
        generatedAt: new Date().toISOString(),
    };

    return {
        titles: titleTagsTldr?.titles ?? getDefaultTitles(processedContent),
        tags,
        tldr: titleTagsTldr?.tldr ?? summary.slice(0, 200),
        summary,
        markdown: markdown ?? processedContent,
        actions,
        provenance,
    };
}

/**
 * Regenerate a specific section of an AI Dump
 */
export async function regenerateSection(
    section: "titles" | "tags" | "markdown" | "actions",
    rawText: string,
    userId: string,
    options: Partial<AIDumpOptions>
): Promise<Partial<AIDumpResult>> {
    const tone = options.tone ?? "balanced";
    const temperature = options.temperature ?? 0.2;

    switch (section) {
        case "titles": {
            const result = await generateTitleTagsTldr(rawText, tone, temperature);
            return { titles: result?.titles ?? getDefaultTitles(rawText) };
        }
        case "tags": {
            const tagResult = await suggestTags(rawText, userId, {
                maxSuggestions: 5,
            });
            return {
                tags: tagResult.suggestions.map((s) => ({
                    name: s.name,
                    confidence: s.confidence,
                })),
            };
        }
        case "markdown": {
            const fullOptions: AIDumpOptions = {
                template: options.template ?? "auto",
                toggles: {
                    titles: true,
                    tags: true,
                    markdown: true,
                    actions: false, // Disabled by default
                    preserveCode: true,
                    ...options.toggles,
                },
                tone,
                temperature,
            };
            const markdown = await generateStructuredMarkdown(rawText, fullOptions);
            return { markdown: markdown ?? rawText };
        }
        case "actions": {
            const actions = await extractActions(rawText);
            return { actions };
        }
        default:
            throw new Error(`Unknown section: ${section}`);
    }
}

// ============================================================================
// Individual Generation Functions
// ============================================================================

interface TitleTagsTldrResult {
    titles: TitleVariant[];
    tags: TagWithConfidence[];
    tldr: string;
}

/**
 * Generate titles, tags, and TL;DR in a single LLM call
 */
async function generateTitleTagsTldr(
    content: string,
    tone: AIDumpTone,
    temperature?: number
): Promise<TitleTagsTldrResult | null> {
    const prompt = PROMPTS.TITLE_TAGS_TLDR;

    const llmOptions: LLMOptions = {
        systemPrompt: prompt.system,
        temperature: temperature ?? prompt.temperature,
        maxTokens: 1000,
    };

    const userPrompt = prompt.getTemplate(tone) + content;

    try {
        const response = await generateText(userPrompt, llmOptions);

        // Parse JSON response
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("No JSON found in LLM response for title/tags/tldr");
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (!parsed.titles || !Array.isArray(parsed.titles)) {
            return null;
        }

        return {
            titles: parsed.titles.map((t: Record<string, unknown>) => ({
                variant: t.variant as TitleVariant["variant"],
                text: String(t.text || ""),
                score: Number(t.score) || 0.5,
            })),
            tags: (parsed.tags || []).map((t: Record<string, unknown>) => ({
                name: String(t.name || ""),
                confidence: Number(t.confidence) || 0.5,
            })),
            tldr: String(parsed.tldr || ""),
        };
    } catch (error) {
        console.error("Error generating title/tags/tldr:", error);
        return null;
    }
}

/**
 * Generate structured Markdown from raw content
 */
async function generateStructuredMarkdown(
    content: string,
    options: AIDumpOptions
): Promise<string | null> {
    const prompt = PROMPTS.MARKDOWN_STRUCTURE;

    const llmOptions: LLMOptions = {
        systemPrompt: prompt.system,
        temperature: options.temperature,
        maxTokens: 3000,
    };

    const userPrompt =
        prompt.getTemplate(options.tone, {
            preserveCode: options.toggles.preserveCode,
            template: options.template,
        }) + content;

    try {
        const response = await generateText(userPrompt, llmOptions);
        return response.text.trim();
    } catch (error) {
        console.error("Error generating markdown:", error);
        return null;
    }
}

/**
 * Extract action items from content
 */
async function extractActions(content: string): Promise<ActionItem[]> {
    const prompt = PROMPTS.ACTION_EXTRACTION;

    const llmOptions: LLMOptions = {
        systemPrompt: prompt.system,
        temperature: prompt.temperature,
        maxTokens: 500,
    };

    const userPrompt = prompt.template + content;

    try {
        const response = await generateText(userPrompt, llmOptions);

        // Parse JSON array response
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return [];
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.map((a: Record<string, unknown>) => ({
            text: String(a.text || ""),
            assignee: String(a.assignee || ""),
            due_date: a.due_date ? String(a.due_date) : null,
            confidence: Number(a.confidence) || 0.5,
        }));
    } catch (error) {
        console.error("Error extracting actions:", error);
        return [];
    }
}

/**
 * Generate a comprehensive summary
 */
async function generateSummary(
    content: string,
    tone: AIDumpTone
): Promise<string> {
    const prompt = PROMPTS.SUMMARY;

    const llmOptions: LLMOptions = {
        systemPrompt: prompt.system,
        temperature: prompt.temperature,
        maxTokens: 500,
    };

    const userPrompt = prompt.getTemplate(tone) + content;

    try {
        const response = await generateText(userPrompt, llmOptions);
        return response.text.trim();
    } catch (error) {
        console.error("Error generating summary:", error);
        // Fallback: return first 500 chars of content
        return content.slice(0, 500) + (content.length > 500 ? "..." : "");
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate default titles when LLM call fails
 */
function getDefaultTitles(content: string): TitleVariant[] {
    const firstLine = content.split("\n")[0].slice(0, 100);
    const words = firstLine.split(/\s+/);

    return [
        {
            variant: "short",
            text: words.slice(0, 5).join(" "),
            score: 0.3,
        },
        {
            variant: "descriptive",
            text: words.slice(0, 12).join(" "),
            score: 0.3,
        },
        {
            variant: "shareable",
            text: firstLine.slice(0, 60),
            score: 0.3,
        },
    ];
}

/**
 * Chunk long content for processing (future: hierarchical summarization)
 */
export function chunkContentForProcessing(
    content: string
): { chunks: string[]; needsSummarization: boolean } {
    if (content.length <= CHUNK_SIZE) {
        return { chunks: [content], needsSummarization: false };
    }

    const chunks = chunkText(content, {
        chunkSize: CHUNK_SIZE,
        overlap: 200,
    });

    return {
        chunks: chunks.map((c) => c.text),
        needsSummarization: chunks.length > 1,
    };
}

// ============================================================================
// Streaming Functions
// ============================================================================

/**
 * Stream structured Markdown generation
 * Yields text chunks as they arrive from the LLM
 */
export async function* streamStructuredMarkdown(
    content: string,
    options: AIDumpOptions
): AsyncGenerator<string, void, unknown> {
    const prompt = PROMPTS.MARKDOWN_STRUCTURE;

    const llmOptions: LLMOptions = {
        systemPrompt: prompt.system,
        temperature: options.temperature,
        maxTokens: 3000,
    };

    const userPrompt =
        prompt.getTemplate(options.tone, {
            preserveCode: options.toggles.preserveCode,
            template: options.template,
        }) + content;

    yield* streamText(userPrompt, llmOptions);
}

/**
 * Stream summary generation
 * Yields text chunks as they arrive from the LLM
 */
export async function* streamSummary(
    content: string,
    tone: AIDumpTone
): AsyncGenerator<string, void, unknown> {
    const prompt = PROMPTS.SUMMARY;

    const llmOptions: LLMOptions = {
        systemPrompt: prompt.system,
        temperature: prompt.temperature,
        maxTokens: 500,
    };

    const userPrompt = prompt.getTemplate(tone) + content;

    yield* streamText(userPrompt, llmOptions);
}

/**
 * Process AI Dump with streaming for markdown
 * Returns non-streamed parts immediately, then streams markdown
 */
export async function* processAIDumpStream(
    content: string,
    userId: string,
    options: AIDumpOptions
): AsyncGenerator<{ type: string; data: unknown }, void, unknown> {
    const MAX_CONTENT_LENGTH_STREAM = 50000;
    const MIN_CONTENT_LENGTH_STREAM = 10;

    // Validate content
    if (!content || content.trim().length < MIN_CONTENT_LENGTH_STREAM) {
        throw new Error("Content is too short for processing");
    }

    // Truncate if too long
    const processedContent =
        content.length > MAX_CONTENT_LENGTH_STREAM
            ? content.slice(0, MAX_CONTENT_LENGTH_STREAM) + "\n\n[Content truncated...]"
            : content;

    // First, generate titles/tags/tldr (non-streaming, needed for UI)
    yield { type: "status", data: "Generating titles and tags..." };

    let titleTagsTldr: TitleTagsTldrResult | null = null;
    try {
        titleTagsTldr = await generateTitleTagsTldr(processedContent, options.tone);
    } catch (e) {
        console.error("Title/tags generation failed:", e);
    }

    // Yield titles
    yield {
        type: "titles",
        data: titleTagsTldr?.titles ?? getDefaultTitles(processedContent),
    };

    // Yield tags (or get from fallback)
    let tags: TagWithConfidence[] = titleTagsTldr?.tags ?? [];
    if (options.toggles.tags && tags.length === 0) {
        try {
            const tagResult = await suggestTags(processedContent, userId, {
                maxSuggestions: 5,
            });
            tags = tagResult.suggestions.map((s) => ({
                name: s.name,
                confidence: s.confidence,
            }));
        } catch {
            tags = [];
        }
    }
    yield { type: "tags", data: tags };

    // Yield TL;DR
    yield { type: "tldr", data: titleTagsTldr?.tldr ?? "" };

    // Stream markdown
    yield { type: "status", data: "Generating structured markdown..." };
    yield { type: "markdown_start", data: null };

    let fullMarkdown = "";
    for await (const chunk of streamStructuredMarkdown(processedContent, options)) {
        fullMarkdown += chunk;
        yield { type: "markdown_chunk", data: chunk };
    }

    yield { type: "markdown_end", data: fullMarkdown };

    // Stream summary
    yield { type: "status", data: "Generating summary..." };
    yield { type: "summary_start", data: null };

    let fullSummary = "";
    for await (const chunk of streamSummary(processedContent, options.tone)) {
        fullSummary += chunk;
        yield { type: "summary_chunk", data: chunk };
    }

    yield { type: "summary_end", data: fullSummary };

    // Extract actions if enabled
    if (options.toggles.actions) {
        yield { type: "status", data: "Extracting action items..." };
        const actions = await extractActions(processedContent);
        yield { type: "actions", data: actions };
    }

    // Final provenance
    yield {
        type: "provenance",
        data: {
            llm_model: "gemini-2.0-flash",
            prompt_template_id: getPromptId("TITLE_TAGS_TLDR"),
            temperature: options.temperature,
            generatedAt: new Date().toISOString(),
        },
    };

    yield { type: "complete", data: null };
}

// Type for internal use
interface TitleTagsTldrResult {
    titles: TitleVariant[];
    tags: TagWithConfidence[];
    tldr: string;
}

