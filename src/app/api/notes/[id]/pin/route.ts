import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * PATCH /api/notes/[id]/pin
 * Toggle the pinned state of a note
 */
export async function PATCH(
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
        // Find the note to check ownership and current pin state
        const note = await prisma.note.findFirst({
            where: {
                id,
                userId: session.user.id,
            },
            select: {
                id: true,
                isPinned: true,
            },
        });

        if (!note) {
            return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        // Toggle pin state
        const newPinnedState = !note.isPinned;

        const updatedNote = await prisma.note.update({
            where: { id },
            data: {
                isPinned: newPinnedState,
                pinnedAt: newPinnedState ? new Date() : null,
            },
            select: {
                id: true,
                isPinned: true,
                pinnedAt: true,
            },
        });

        return NextResponse.json({
            success: true,
            note: updatedNote,
        });
    } catch (error) {
        console.error("Error toggling pin:", error);
        return NextResponse.json(
            { error: "Failed to update pin status" },
            { status: 500 }
        );
    }
}
