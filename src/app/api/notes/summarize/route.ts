/**
 * Summarization API Routes
 *
 * POST /api/notes/summarize - Generate summary for a note (supports multimodal)
 */

import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { JSONContent } from "@tiptap/core";
import {
    generateSummary,
    generateSummaryMultimodal,
    generateTitle,
    generateContentHash,
    hasContentChanged,
    extractContentFromJSON,
    validateContentForSummary,
    prepareMultimodalContent,
    needsMultimodalProcessing,
    type SummarizationOptions,
    type ContextOptions,
} from "@/lib/ai";
import { errorResponse } from "@/lib/api-error";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Request validation schema with context options
const summarizeRequestSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
    options: z
        .object({
            length: z.enum(["short", "medium", "long"]).optional(),
            style: z.enum(["bullet", "paragraph", "tldr"]).optional(),
            includeKeywords: z.boolean().optional(),
            generateTitle: z.boolean().optional(),
            force: z.boolean().optional(), // Force re-summarization even if content unchanged
        })
        .optional(),
    context: z
        .object({
            includeText: z.boolean().optional(),
            includeImages: z.boolean().optional(),
            maxImages: z.number().min(1).max(10).optional(),
            includeTitle: z.boolean().optional(),
        })
        .optional(),
});

/**
 * POST /api/notes/summarize
 *
 * Generate a summary for a note with optional multimodal support
 */
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = enforceRateLimit(session.user.id, RATE_LIMITS.ai);
    if (limited) return limited;

    try {
        const body = await request.json();
        const result = summarizeRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.issues },
                { status: 400 }
            );
        }

        const { noteId, options = {}, context = {} } = result.data;
        const { force = false, ...summarizationOptions } = options;
        const contextOptions: ContextOptions = {
            includeText: context.includeText ?? true,
            includeImages: context.includeImages ?? false,
            maxImages: context.maxImages ?? 5,
            includeTitle: context.includeTitle ?? true,
        };

        // Fetch the note with contentJSON for multimodal support
        const note = await prisma.note.findUnique({
            where: { id: noteId, userId: session.user.id },
            select: {
                id: true,
                title: true,
                contentJSON: true,
                contentText: true,
                summary: true,
                contentHash: true,
            },
        });

        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        // Extract structured content from JSON
        const extracted = extractContentFromJSON(note.contentJSON as JSONContent);

        // Validate content is sufficient
        const validation = validateContentForSummary(extracted, contextOptions);
        if (!validation.canSummarize) {
            return NextResponse.json({
                success: false,
                error: validation.message,
                suggestion: validation.suggestion,
                suggestMultimodal: validation.suggestMultimodal,
            }, { status: 400 });
        }

        // Check if content has changed since last summarization
        const currentHash = generateContentHash(note.contentText);
        if (!force && !hasContentChanged(currentHash, note.contentHash) && note.summary) {
            return NextResponse.json({
                success: true,
                cached: true,
                summary: note.summary,
                contentHash: currentHash,
            });
        }

        let summaryResult;

        // Use multimodal summarization if images are included
        if (needsMultimodalProcessing(extracted, contextOptions)) {
            const multimodalParts = await prepareMultimodalContent(extracted, note.title, contextOptions);

            if (multimodalParts.length === 0) {
                return NextResponse.json({
                    success: false,
                    error: "Failed to prepare content for summarization.",
                }, { status: 400 });
            }

            summaryResult = await generateSummaryMultimodal(multimodalParts, summarizationOptions as SummarizationOptions);
        } else {
            // Standard text-only summarization
            const fullContent = `Title: ${note.title}\n\n${note.contentText}`;
            summaryResult = await generateSummary(fullContent, summarizationOptions as SummarizationOptions);
        }

        // Update note with summary
        const updateData: Record<string, unknown> = {
            summary: summaryResult.summary,
            contentHash: summaryResult.contentHash,
            aiProcessedAt: new Date(),
        };

        if (summaryResult.generatedTitle) {
            updateData.generatedTitle = summaryResult.generatedTitle;
        }

        await prisma.note.update({
            where: { id: noteId },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            cached: false,
            summary: summaryResult.summary,
            generatedTitle: summaryResult.generatedTitle,
            keywords: summaryResult.keywords,
            confidence: summaryResult.confidence,
            contentHash: summaryResult.contentHash,
            provider: summaryResult.provider,
            latencyMs: summaryResult.latencyMs,
            multimodal: needsMultimodalProcessing(extracted, contextOptions),
        });
    } catch (error) {
        console.error("Error generating summary:", error);
        return errorResponse("Failed to generate summary", 500, error);
    }
}

/**
 * GET /api/notes/summarize
 *
 * Generate just a title for content (lightweight operation)
 */
export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = enforceRateLimit(session.user.id, RATE_LIMITS.ai);
    if (limited) return limited;

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");

    if (!noteId) {
        return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    try {
        const note = await prisma.note.findUnique({
            where: { id: noteId, userId: session.user.id },
            select: { contentText: true },
        });

        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        const result = await generateTitle(note.contentText);

        return NextResponse.json({
            success: true,
            title: result.title,
            provider: result.provider,
        });
    } catch (error) {
        console.error("Error generating title:", error);
        return errorResponse("Failed to generate title", 500, error);
    }
}
