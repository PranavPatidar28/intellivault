import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";

const mergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string()).min(1),
  targetTagId: z.string(),
});

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = mergeTagsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { targetTagId } = parsed.data;
    // Exclude the target from the sources so a self-merge can't soft-delete the
    // target or strip it from notes via a disconnect+connect of the same id.
    const sourceTagIds = parsed.data.sourceTagIds.filter(
      (id) => id !== targetTagId
    );

    if (sourceTagIds.length === 0) {
      return NextResponse.json(
        { error: "No source tags to merge (cannot merge a tag into itself)" },
        { status: 400 }
      );
    }

    // Verify target tag exists and belongs to user
    const targetTag = await prisma.tag.findFirst({
      where: {
        id: targetTagId,
        userId: session.user.id,
      },
    });

    if (!targetTag) {
      return NextResponse.json(
        { error: "Target tag not found" },
        { status: 404 }
      );
    }

    // Get all notes with source tags (scoped to the caller's own tags)
    const sourceTags = await prisma.tag.findMany({
      where: {
        id: { in: sourceTagIds },
        userId: session.user.id,
      },
      include: {
        notes: true,
      },
    });

    // Collect all note IDs
    const noteIds = new Set<string>();
    sourceTags.forEach((tag) => {
      tag.notes.forEach((note) => noteIds.add(note.id));
    });

    // Perform reassignment, source soft-delete, and target touch atomically so
    // a mid-operation failure can't leave the tag graph inconsistent.
    await prisma.$transaction([
      ...Array.from(noteIds).map((noteId) =>
        prisma.note.update({
          where: { id: noteId },
          data: {
            tags: {
              disconnect: sourceTagIds.map((id) => ({ id })),
              connect: { id: targetTagId },
            },
          },
        })
      ),
      prisma.tag.updateMany({
        where: {
          id: { in: sourceTagIds },
          userId: session.user.id,
        },
        data: {
          deletedAt: new Date(),
        },
      }),
      prisma.tag.update({
        where: { id: targetTagId },
        data: {
          lastUsed: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      mergedNotesCount: noteIds.size,
    });
  } catch (error) {
    console.error("Error merging tags:", error);
    return NextResponse.json(
      { error: "Failed to merge tags" },
      { status: 500 }
    );
  }
}
