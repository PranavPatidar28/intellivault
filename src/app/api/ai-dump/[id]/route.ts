import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NoteStatus } from "@/generated/prisma";

/**
 * GET /api/ai-dump/[id]
 * Fetch a specific draft note
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const note = await prisma.note.findFirst({
            where: {
                id,
                userId: session.user.id,
            },
            include: {
                tags: true,
            },
        });

        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            note: {
                id: note.id,
                userId: note.userId,
                rawText: note.rawText,
                generatedMd: note.contentText,
                titles: note.titles,
                tags: note.tags,
                tldr: note.tldr,
                summary: note.summary,
                actions: note.actions,
                embeddings: note.embeddingsMeta,
                versions: note.versions,
                status: note.status,
                provenance: note.provenance,
                createdAt: note.createdAt.toISOString(),
                updatedAt: note.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error("Error fetching AI Dump:", error);
        return NextResponse.json(
            { error: "Failed to fetch AI Dump" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/ai-dump/[id]
 * Delete a draft note
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth.api.getSession({
        headers: await nextHeaders(),
    });

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        // Verify ownership and that it's a draft
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

        await prisma.note.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: "Draft deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting AI Dump:", error);
        return NextResponse.json(
            { error: "Failed to delete AI Dump" },
            { status: 500 }
        );
    }
}
