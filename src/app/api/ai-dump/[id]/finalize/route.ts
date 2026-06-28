import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { finalizeNoteSchema } from "@/lib/validations/ai-dump";
import { NoteStatus } from "@/generated/prisma";
import { slugify } from "@/lib/utils/text";
import { markdownToTipTap, stripCodeFences } from "@/lib/utils/markdown-to-tiptap";
import { errorResponse } from "@/lib/api-error";

/**
 * POST /api/ai-dump/[id]/finalize
 * Convert a draft note to a final note
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

    const { id } = await params;

    try {
        const json = await request.json();
        const result = finalizeNoteSchema.safeParse(json);

        if (!result.success) {
            return NextResponse.json(
                { error: "Validation failed", details: result.error.issues },
                { status: 400 }
            );
        }

        const { selectedTitle, selectedTags, finalMarkdown, retainRaw } =
            result.data;

        // Fetch the draft note
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

        // Strip code fences and convert markdown to TipTap JSON
        const cleanMarkdown = stripCodeFences(finalMarkdown);
        const contentJSON = markdownToTipTap(cleanMarkdown);

        // Update the note to FINAL status with selected content
        const updatedNote = await prisma.note.update({
            where: { id },
            data: {
                title: selectedTitle,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                contentJSON: contentJSON as any, // TipTap-compatible JSON for editor
                contentText: cleanMarkdown, // Plain markdown for search/display
                status: NoteStatus.FINAL,
                // Clear raw text if not retaining
                rawText: retainRaw ? note.rawText : null,
                // Connect or create tags
                tags: {
                    connectOrCreate: selectedTags.map((tagName) => ({
                        where: {
                            userId_name: {
                                userId: session.user.id,
                                name: tagName,
                            },
                        },
                        create: {
                            name: tagName,
                            slug: slugify(tagName),
                            userId: session.user.id,
                        },
                    })),
                },
                updatedAt: new Date(),
            },
            include: {
                tags: true,
            },
        });

        // Trigger re-embedding for the finalized note
        import("@/lib/ai/embedding-sync").then(({ embedNote }) => {
            embedNote(updatedNote.id, { userId: session.user.id }).catch((err: unknown) =>
                console.error(`Failed to re-embed finalized note ${updatedNote.id}:`, err)
            );
        });

        return NextResponse.json({
            success: true,
            noteId: updatedNote.id,
            status: "saved",
            note: {
                id: updatedNote.id,
                title: updatedNote.title,
                tags: updatedNote.tags.map((t) => t.name),
                status: updatedNote.status,
                updatedAt: updatedNote.updatedAt.toISOString(),
            },
        });
    } catch (error) {
        console.error("Error finalizing AI Dump:", error);
        return errorResponse("Failed to finalize AI Dump", 500, error);
    }
}
