/**
 * Auto-Tagging Service
 *
 * Intelligently suggests and applies tags to notes using LLM providers.
 * Prioritizes matching with user's existing tags and supports hierarchical tags.
 */

import prisma from "@/lib/prisma";
import { generateText, type LLMOptions } from "./llm-provider";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TagSuggestion {
    /** Tag name */
    name: string;
    /** URL-friendly slug */
    slug: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Reason for suggestion */
    reason: string;
    /** Whether this tag already exists in user's tags */
    isExisting: boolean;
    /** ID of existing tag (if applicable) */
    existingTagId?: string;
    /** Hex color (if existing tag has one) */
    color?: string;
}

export interface AutoTagOptions {
    /** Maximum number of suggestions */
    maxSuggestions?: number;
    /** Minimum confidence threshold (0-1) */
    minConfidence?: number;
    /** Whether to auto-apply high-confidence tags */
    autoApply?: boolean;
    /** Confidence threshold for auto-apply */
    autoApplyThreshold?: number;
    /** LLM options override */
    llmOptions?: LLMOptions;
}

export interface AutoTagResult {
    /** Tag suggestions */
    suggestions: TagSuggestion[];
    /** Tags that were auto-applied (if autoApply was true) */
    appliedTags?: string[];
    /** LLM provider used */
    provider: string;
    /** Processing time in milliseconds */
    latencyMs?: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a URL-friendly slug from a tag name
 */
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
}

// ============================================================================
// Auto-Tagging Functions
// ============================================================================

/**
 * Get tag suggestions for note content
 */
export async function suggestTags(
    content: string,
    userId: string,
    options: AutoTagOptions = {}
): Promise<AutoTagResult> {
    const {
        maxSuggestions = 5,
        minConfidence = 0.3,
        llmOptions = {},
    } = options;

    // Fetch user's existing tags for context
    const existingTags = await prisma.tag.findMany({
        where: {
            userId,
            deletedAt: null,
            isArchived: false,
        },
        select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            usageCount: true,
        },
        orderBy: { usageCount: "desc" },
        take: 100,
    });

    const existingTagNames = existingTags.map((t) => t.name);

    // Build the prompt
    const prompt = buildTaggingPrompt(content, existingTagNames, maxSuggestions);

    const systemPrompt = `You are a precise tagging assistant. You analyze content and suggest relevant tags. Prefer using existing tags when they fit well. Always respond with valid JSON.`;

    try {
        const response = await generateText(prompt, {
            ...llmOptions,
            maxTokens: 500,
            temperature: 0.4,
            systemPrompt,
        });

        // Parse the response
        const rawSuggestions = parseTagResponse(response.text);

        // Enrich suggestions with existing tag data
        const suggestions: TagSuggestion[] = rawSuggestions
            .map((raw) => {
                const existingTag = existingTags.find(
                    (t) => t.name.toLowerCase() === raw.name.toLowerCase()
                );

                return {
                    name: existingTag?.name || raw.name,
                    slug: existingTag?.slug || generateSlug(raw.name),
                    confidence: Math.min(1, Math.max(0, raw.confidence || 0.5)),
                    reason: raw.reason || "AI suggested",
                    isExisting: !!existingTag,
                    existingTagId: existingTag?.id,
                    color: existingTag?.color || undefined,
                };
            })
            .filter((s) => s.confidence >= minConfidence)
            .slice(0, maxSuggestions);

        return {
            suggestions,
            provider: response.provider,
            latencyMs: response.latencyMs,
        };
    } catch (error) {
        console.error("Auto-tagging failed:", error);
        throw new Error(
            `Failed to generate tag suggestions: ${error instanceof Error ? error.message : "Unknown error"}`
        );
    }
}

/**
 * Suggest and optionally apply tags to a note
 */
export async function autoTagNote(
    noteId: string,
    userId: string,
    options: AutoTagOptions = {}
): Promise<AutoTagResult> {
    const {
        autoApply = false,
        autoApplyThreshold = 0.7,
    } = options;

    // Fetch the note
    const note = await prisma.note.findUnique({
        where: { id: noteId, userId },
        select: {
            id: true,
            title: true,
            contentText: true,
            tags: { select: { id: true, name: true } },
        },
    });

    if (!note) {
        throw new Error("Note not found");
    }

    // Combine title and content for better context
    const fullContent = `Title: ${note.title}\n\n${note.contentText}`;

    // Get suggestions
    const result = await suggestTags(fullContent, userId, options);

    // Filter out already-applied tags
    const existingTagNames = new Set(note.tags.map((t) => t.name.toLowerCase()));
    result.suggestions = result.suggestions.filter(
        (s) => !existingTagNames.has(s.name.toLowerCase())
    );

    // Auto-apply high-confidence tags if requested
    if (autoApply) {
        const tagsToApply = result.suggestions.filter(
            (s) => s.confidence >= autoApplyThreshold && s.isExisting
        );

        if (tagsToApply.length > 0) {
            await prisma.note.update({
                where: { id: noteId },
                data: {
                    tags: {
                        connect: tagsToApply
                            .filter((t) => t.existingTagId)
                            .map((t) => ({ id: t.existingTagId! })),
                    },
                },
            });

            // Update usage counts
            await prisma.tag.updateMany({
                where: {
                    id: { in: tagsToApply.map((t) => t.existingTagId!).filter(Boolean) },
                },
                data: {
                    usageCount: { increment: 1 },
                    lastUsed: new Date(),
                },
            });

            result.appliedTags = tagsToApply.map((t) => t.name);
        }
    }

    return result;
}

/**
 * Apply specific suggested tags to a note
 */
export async function applyTagsToNote(
    noteId: string,
    userId: string,
    tagNames: string[],
    options: { defaultColor?: string | null } = {}
): Promise<{ applied: string[]; created: string[] }> {
    const applied: string[] = [];
    const created: string[] = [];
    const { defaultColor } = options;

    for (const tagName of tagNames) {
        const slug = generateSlug(tagName);

        // Find or create the tag
        let tag = await prisma.tag.findFirst({
            where: {
                userId,
                OR: [
                    { name: { equals: tagName, mode: "insensitive" } },
                    { slug },
                ],
            },
        });

        if (!tag) {
            // Create new tag with optional default color from user preferences
            tag = await prisma.tag.create({
                data: {
                    name: tagName,
                    slug,
                    userId,
                    color: defaultColor || null,
                },
            });
            created.push(tagName);
        }

        // Connect tag to note
        await prisma.note.update({
            where: { id: noteId },
            data: {
                tags: { connect: { id: tag.id } },
            },
        });

        // Update usage count
        await prisma.tag.update({
            where: { id: tag.id },
            data: {
                usageCount: { increment: 1 },
                lastUsed: new Date(),
            },
        });

        applied.push(tagName);
    }

    return { applied, created };
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildTaggingPrompt(
    content: string,
    existingTags: string[],
    maxSuggestions: number
): string {
    // Truncate very long content
    const truncatedContent = content.length > 6000 ? content.slice(0, 6000) + "..." : content;

    return `Analyze the following content and suggest up to ${maxSuggestions} relevant tags.

EXISTING TAGS (prefer these when applicable):
${existingTags.length > 0 ? existingTags.join(", ") : "(No existing tags)"}

CONTENT:
${truncatedContent}

INSTRUCTIONS:
1. Suggest tags that categorize the content's topics, themes, or type
2. Prefer existing tags when they fit well (higher confidence for matches)
3. Suggest new tags only when existing ones don't cover important topics
4. Tags should be 1-3 words, lowercase
5. Assign confidence scores based on relevance (0.0-1.0)

Respond with a JSON array of objects:
[
  { "name": "tag-name", "confidence": 0.9, "reason": "brief reason" },
  ...
]`;
}

interface RawTagSuggestion {
    name: string;
    confidence?: number;
    reason?: string;
}

function parseTagResponse(responseText: string): RawTagSuggestion[] {
    try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch =
            responseText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
            responseText.match(/(\[[\s\S]*\])/);

        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed)) {
                return parsed.filter(
                    (item) => item && typeof item.name === "string" && item.name.trim()
                );
            }
        }
    } catch {
        // JSON parsing failed
    }

    // Fallback: try to extract tag names from text
    const tagMatches = responseText.match(/"name":\s*"([^"]+)"/g);
    if (tagMatches) {
        return tagMatches.map((match) => {
            const name = match.match(/"name":\s*"([^"]+)"/)?.[1] || "";
            return { name, confidence: 0.5 };
        });
    }

    return [];
}
