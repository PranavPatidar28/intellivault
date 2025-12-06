/**
 * Auto-Tagging API Routes
 *
 * POST /api/notes/auto-tag - Get tag suggestions for a note
 */

import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
    autoTagNote,
    applyTagsToNote,
} from "@/lib/ai/auto-tagging-service";

// Request validation schema
const autoTagRequestSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
    maxSuggestions: z.number().int().min(1).max(10).optional().default(5),
    minConfidence: z.number().min(0).max(1).optional().default(0.3),
    autoApply: z.boolean().optional().default(false),
    autoApplyThreshold: z.number().min(0).max(1).optional().default(0.7),
});

const applyTagsRequestSchema = z.object({
    noteId: z.string().min(1, "Note ID is required"),
    tagNames: z.array(z.string().min(1)).min(1, "At least one tag name required"),
});

/**
 * POST /api/notes/auto-tag
 *
 * Get tag suggestions for a note, optionally auto-apply high-confidence tags
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
        const result = autoTagRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.issues },
                { status: 400 }
            );
        }

        const { noteId, ...options } = result.data;

        const tagResult = await autoTagNote(noteId, session.user.id, options);

        return NextResponse.json({
            success: true,
            suggestions: tagResult.suggestions,
            appliedTags: tagResult.appliedTags,
            provider: tagResult.provider,
            latencyMs: tagResult.latencyMs,
        });
    } catch (error) {
        console.error("Error generating tag suggestions:", error);

        if (error instanceof Error && error.message === "Note not found") {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate tag suggestions" },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/notes/auto-tag
 *
 * Apply specific tags to a note (create new tags if needed)
 */
export async function PUT(request: NextRequest) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const result = applyTagsRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.issues },
                { status: 400 }
            );
        }

        const { noteId, tagNames } = result.data;

        const applyResult = await applyTagsToNote(noteId, session.user.id, tagNames);

        return NextResponse.json({
            success: true,
            applied: applyResult.applied,
            created: applyResult.created,
        });
    } catch (error) {
        console.error("Error applying tags:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to apply tags" },
            { status: 500 }
        );
    }
}
