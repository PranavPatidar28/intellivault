/**
 * Summarization API Routes
 *
 * POST /api/notes/summarize - Generate summary for a note
 */

import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import {
    generateSummary,
    generateTitle,
    generateContentHash,
    hasContentChanged,
    type SummarizationOptions,
} from "@/lib/ai/summarization-service";

// Request validation schema
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
});

/**
 * POST /api/notes/summarize
 *
 * Generate a summary for a note
 */
export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const result = summarizeRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.issues },
                { status: 400 }
            );
        }

        const { noteId, options = {} } = result.data;
        const { force = false, ...summarizationOptions } = options;

        // Fetch the note
        const note = await prisma.note.findUnique({
            where: { id: noteId, userId: session.user.id },
            select: {
                id: true,
                title: true,
                contentText: true,
                summary: true,
                contentHash: true,
            },
        });

        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
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

        // Generate summary
        const fullContent = `Title: ${note.title}\n\n${note.contentText}`;
        const summaryResult = await generateSummary(fullContent, summarizationOptions as SummarizationOptions);

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
        });
    } catch (error) {
        console.error("Error generating summary:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate summary" },
            { status: 500 }
        );
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
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate title" },
            { status: 500 }
        );
    }
}
