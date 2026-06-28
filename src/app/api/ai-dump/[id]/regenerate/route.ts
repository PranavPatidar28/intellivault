import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { regenerateSectionSchema } from "@/lib/validations/ai-dump";
import { regenerateSection } from "@/lib/ai/ai-dump-service";
import { NoteStatus } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";
import { errorResponse } from "@/lib/api-error";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

interface VersionSnapshot {
    versionId: string;
    timestamp: string;
    section: string;
    previousValue: unknown;
}

/**
 * POST /api/ai-dump/[id]/regenerate
 * Regenerate a specific section of an AI Dump
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = enforceRateLimit(session.user.id, RATE_LIMITS.ai);
    if (limited) return limited;

    const { id } = await params;

    try {
        const json = await request.json();
        const result = regenerateSectionSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.issues },
                { status: 400 }
            );
        }

        const { section, options } = result.data;

        // Fetch the note
        const note = await prisma.note.findFirst({
            where: {
                id,
                userId: session.user.id,
                status: NoteStatus.DRAFT,
            },
        });

        if (!note) {
            return NextResponse.json(
                { error: "Draft not found or not authorized" },
                { status: 404 }
            );
        }

        if (!note.rawText) {
            return NextResponse.json(
                { error: "No raw text available for regeneration" },
                { status: 400 }
            );
        }

        // Save current value to version history
        const currentVersions = (note.versions as unknown as VersionSnapshot[]) || [];
        const previousValue = getSectionValue(note, section);

        const newVersion: VersionSnapshot = {
            versionId: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date().toISOString(),
            section,
            previousValue,
        };

        // Regenerate the section
        const regenerated = await regenerateSection(
            section,
            note.rawText,
            session.user.id,
            options ?? {}
        );

        // Build update data
        const updateData: Prisma.NoteUpdateInput = {
            versions: [...currentVersions, newVersion] as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
        };

        // Update the specific section
        switch (section) {
            case "titles":
                updateData.titles = regenerated.titles;
                break;
            case "tags":
                // Tags are in the result but stored separately - we'll return them
                break;
            case "markdown":
                updateData.contentText = regenerated.markdown;
                break;
            case "actions":
                updateData.actions = regenerated.actions;
                break;
        }

        await prisma.note.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            updatedSection: regenerated,
            versionId: newVersion.versionId,
        });
    } catch (error) {
        console.error("Error regenerating section:", error);
        return errorResponse("Failed to regenerate section", 500, error);
    }
}

/**
 * Get the current value of a section from a note
 */
function getSectionValue(
    note: {
        titles: Prisma.JsonValue;
        contentText: string;
        actions: Prisma.JsonValue;
    },
    section: string
): unknown {
    switch (section) {
        case "titles":
            return note.titles;
        case "markdown":
            return note.contentText;
        case "actions":
            return note.actions;
        default:
            return null;
    }
}
