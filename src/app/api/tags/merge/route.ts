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
    const { sourceTagIds, targetTagId } = mergeTagsSchema.parse(body);

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

    // Get all notes with source tags
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

    // Update all notes to use target tag
    await prisma.$transaction(
      Array.from(noteIds).map((noteId) =>
        prisma.note.update({
          where: { id: noteId },
          data: {
            tags: {
              disconnect: sourceTagIds.map((id) => ({ id })),
              connect: { id: targetTagId },
            },
          },
        })
      )
    );

    // Soft delete source tags
    await prisma.tag.updateMany({
      where: {
        id: { in: sourceTagIds },
        userId: session.user.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    // Update target tag's lastUsed
    await prisma.tag.update({
      where: { 
        id: targetTagId,
        userId: session.user.id,
      },
      data: {
        lastUsed: new Date(),
      },
    });

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
