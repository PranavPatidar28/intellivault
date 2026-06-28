/**
 * AI Dump Service
 *
 * Orchestrates the AI Dump pipeline: ingests raw content and generates
 * structured output with titles, tags, TL;DR, markdown, and action items.
 * Uses the Vercel AI SDK via ./generate (structured output + streaming with
 * reasoning separation).
 */

import { genText, genObject, genFullStream, EmptyContentError, type GenOptions } from "./generate";
import { getModelLabel } from "./provider";
import { suggestTags } from "./auto-tagging-service";
import { chunkText } from "./chunker";
import { PROMPTS, getPromptId } from "./ai-dump-prompts";
import {
    titleTagsTldrSchema,
    actionsSchema,
    type AIDumpOptions,
    type AIDumpResult,
    type TitleVariant,
    type TagWithConfidence,
    type ActionItem,
    type Provenance,
    type AIDumpTone,
} from "@/lib/validations/ai-dump";

// ============================================================================
// Constants
// ============================================================================

const MAX_CONTENT_LENGTH = 50000; // Max characters before chunking
const CHUNK_SIZE = 4000;
const MIN_CONTENT_LENGTH = 10;

interface TitleTagsTldrResult {
    titles: TitleVariant[];
    tags: TagWithConfidence[];
    tldr: string;
}

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
        llm_model: getModelLabel(),
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

/**
 * Generate titles, tags, and TL;DR in a single structured LLM call.
 */
async function generateTitleTagsTldr(
    content: string,
    tone: AIDumpTone,
    temperature?: number
): Promise<TitleTagsTldrResult | null> {
    const prompt = PROMPTS.TITLE_TAGS_TLDR;
    const userPrompt = prompt.getTemplate(tone) + content;

    try {
        const { object } = await genObject(userPrompt, titleTagsTldrSchema, {
            system: prompt.system,
            temperature: temperature ?? prompt.temperature,
            maxOutputTokens: 1000,
        });
        return {
            titles: object.titles,
            tags: object.tags,
            tldr: object.tldr,
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
    const userPrompt =
        prompt.getTemplate(options.tone, {
            preserveCode: options.toggles.preserveCode,
            template: options.template,
        }) + content;

    try {
        const result = await genText(userPrompt, {
            system: prompt.system,
            temperature: options.temperature,
            maxOutputTokens: 3000,
        });
        return result.text.trim();
    } catch (error) {
        console.error("Error generating markdown:", error);
        return null;
    }
}

/**
 * Extract action items from content (structured output).
 */
async function extractActions(content: string): Promise<ActionItem[]> {
    const prompt = PROMPTS.ACTION_EXTRACTION;
    const userPrompt = prompt.template + content;

    try {
        const { object } = await genObject(userPrompt, actionsSchema, {
            system: prompt.system,
            temperature: prompt.temperature,
            maxOutputTokens: 500,
        });
        return object.actions;
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
    const userPrompt = prompt.getTemplate(tone) + content;

    try {
        const result = await genText(userPrompt, {
            system: prompt.system,
            temperature: prompt.temperature,
            maxOutputTokens: 500,
        });
        return result.text.trim();
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
    const firstLine = (content.split("\n")[0] ?? "").slice(0, 100);
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
 * Stream structured Markdown generation. Yields text chunks (no reasoning).
 */
export async function* streamStructuredMarkdown(
    content: string,
    options: AIDumpOptions
): AsyncGenerator<string, void, unknown> {
    const prompt = PROMPTS.MARKDOWN_STRUCTURE;
    const userPrompt =
        prompt.getTemplate(options.tone, {
            preserveCode: options.toggles.preserveCode,
            template: options.template,
        }) + content;

    const llmOptions: GenOptions = {
        system: prompt.system,
        temperature: options.temperature,
        maxOutputTokens: 3000,
    };

    for await (const part of genFullStream(userPrompt, llmOptions)) {
        if (part.kind === "text") yield part.value;
    }
}

/**
 * Stream summary generation. Yields text chunks (no reasoning).
 */
export async function* streamSummary(
    content: string,
    tone: AIDumpTone
): AsyncGenerator<string, void, unknown> {
    const prompt = PROMPTS.SUMMARY;
    const userPrompt = prompt.getTemplate(tone) + content;

    const llmOptions: GenOptions = {
        system: prompt.system,
        temperature: prompt.temperature,
        maxOutputTokens: 500,
    };

    for await (const part of genFullStream(userPrompt, llmOptions)) {
        if (part.kind === "text") yield part.value;
    }
}

/**
 * Process AI Dump with streaming. Emits structured events; markdown and
 * summary stream incrementally with reasoning surfaced as separate events.
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

    // Stream markdown (text + reasoning as separate events)
    yield { type: "status", data: "Generating structured markdown..." };
    yield { type: "markdown_start", data: null };

    let fullMarkdown = "";
    const mdPrompt = PROMPTS.MARKDOWN_STRUCTURE;
    const mdUserPrompt =
        mdPrompt.getTemplate(options.tone, {
            preserveCode: options.toggles.preserveCode,
            template: options.template,
        }) + processedContent;
    for await (const part of genFullStream(mdUserPrompt, {
        system: mdPrompt.system,
        temperature: options.temperature,
        maxOutputTokens: 3000,
    })) {
        if (part.kind === "reasoning") {
            yield { type: "reasoning", data: part.value };
        } else {
            fullMarkdown += part.value;
            yield { type: "markdown_chunk", data: part.value };
        }
    }
    // Fallback so an empty (reasoning-only) generation never yields blank content.
    if (fullMarkdown.trim() === "") fullMarkdown = processedContent;

    yield { type: "markdown_end", data: fullMarkdown };

    // Stream summary (text + reasoning as separate events)
    yield { type: "status", data: "Generating summary..." };
    yield { type: "summary_start", data: null };

    let fullSummary = "";
    const sumPrompt = PROMPTS.SUMMARY;
    const sumUserPrompt = sumPrompt.getTemplate(options.tone) + processedContent;
    for await (const part of genFullStream(sumUserPrompt, {
        system: sumPrompt.system,
        temperature: sumPrompt.temperature,
        maxOutputTokens: 500,
    })) {
        if (part.kind === "reasoning") {
            yield { type: "reasoning", data: part.value };
        } else {
            fullSummary += part.value;
            yield { type: "summary_chunk", data: part.value };
        }
    }
    if (fullSummary.trim() === "") {
        fullSummary = titleTagsTldr?.tldr || processedContent.slice(0, 500);
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
            llm_model: getModelLabel(),
            prompt_template_id: getPromptId("TITLE_TAGS_TLDR"),
            temperature: options.temperature,
            generatedAt: new Date().toISOString(),
        },
    };

    yield { type: "complete", data: null };
}

// Keep EmptyContentError referenced for callers that want to special-case it.
export { EmptyContentError };
