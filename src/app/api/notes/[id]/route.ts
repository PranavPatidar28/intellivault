import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { updateNoteSchema } from "@/lib/validations/note";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const note = await prisma.note.findFirst({
      where: {
        userId: session.user.id,
        id,
      },
      select: {
        id: true,
        title: true,
        contentJSON: true,
        contentText: true,
        createdAt: true,
        updatedAt: true,
        tags: true,
        summary: true,
        generatedTitle: true,
      },
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      note,
    });
  } catch (error) {
    console.error("Error fetching note:", error);
    return NextResponse.json(
      { error: "Failed to fetch note" },
      { status: 500 }
    );
  }
}

import { slugify } from "@/lib/utils/text";

// ... (existing imports)

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await nextHeaders() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const result = updateNoteSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 }
      );
    }

    const body = result.data;

    // Check if note exists and belongs to user
    const existingNote = await prisma.note.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Handle tags if provided
    let tagConnect: { id: string }[] | undefined;
    if (body.tags) {
      // Resolve all tags (find or create)
      const tags = await Promise.all(
        body.tags.map(async (tagName) => {
          const slug = slugify(tagName);
          return await prisma.tag.upsert({
            where: {
              userId_slug: {
                userId: session.user.id,
                slug: slug
              }
            },
            update: {}, // No update if exists
            create: {
              name: tagName,
              slug: slug,
              userId: session.user.id,
            },
          });
        })
      );
      tagConnect = tags.map((t) => ({ id: t.id }));
    }

    const note = await prisma.note.update({
      where: { id },
      data: {
        title: body.title,
        contentJSON: body.contentJSON,
        contentText: body.contentText,
        embeddingStatus: "PENDING", // Mark as pending
        tags: tagConnect ? { set: tagConnect } : undefined,
      },
      include: {
        tags: true,
      },
    });

    // Trigger embedding in background
    import("@/lib/ai/embedding-sync").then(({ embedNote }) => {
      embedNote(note.id).catch((err: unknown) =>
        console.error(`Failed to auto-embed updated note ${note.id}:`, err)
      );
    });

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        title: note.title,
        contentJSON: note.contentJSON,
        contentText: note.contentText,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check existence first
    const existingNote = await prisma.note.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existingNote) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prisma.note.delete({
      where: {
        id,
      },
    });

    // Clean up vectors in background
    import("@/lib/ai/embedding-sync").then(({ handleNoteDeleted }) => {
      handleNoteDeleted(id, session.user.id).catch((err: unknown) =>
        console.error(`Failed to clean up embedding for note ${id}:`, err)
      );
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
