import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createNoteSchema, noteQuerySchema } from "@/lib/validations/note";

import { slugify } from "@/lib/utils/text";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const result = createNoteSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 }
      );
    }

    const body = result.data;

    const note = await prisma.note.create({
      data: {
        title: body.title,
        contentJSON: body.contentJSON ?? {},
        contentText: body.contentText ?? "",
        userId: session.user.id,
        embeddingStatus: "PENDING", // Explicitly set pending
        tags: {
          connectOrCreate: body.tags?.map((tag) => ({
            where: {
              userId_name: {
                userId: session.user.id,
                name: tag
              }
            },
            create: {
              name: tag,
              slug: slugify(tag),
              userId: session.user.id,
            },
          })),
        },
      },
      include: {
        tags: true,
      },
    });

    // Trigger embedding in background (fire and forget pattern)
    // We catch errors so we don't block the UI response
    import("@/lib/ai/embedding-sync").then(({ embedNote }) => {
      embedNote(note.id).catch((err: unknown) =>
        console.error(`Failed to auto-embed note ${note.id}:`, err)
      );
    });

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        title: note.title,
        content: note.contentJSON,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const result = noteQuerySchema.safeParse({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 }
      );
    }

    const query = result.data;
    const skip = (query.page - 1) * query.limit;

    const [notes, total] = await Promise.all([
      prisma.note.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: [
          { isPinned: "desc" }, // Pinned notes first
          { pinnedAt: "desc" }, // Then by pin date
          { updatedAt: "desc" }, // Then by update date
        ],
        skip,
        take: query.limit,
        select: {
          id: true,
          title: true,
          contentJSON: true,
          contentText: true,
          summary: true,
          isPinned: true,
          pinnedAt: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { attachments: true }
          }
        },
      }),
      prisma.note.count({
        where: {
          userId: session.user.id,
        },
      }),
    ]);

    // Map to include attachmentCount
    const notesWithAttachmentCount = notes.map(note => ({
      ...note,
      attachmentCount: note._count.attachments,
      _count: undefined,
    }));

    return NextResponse.json({
      success: true,
      notes: notesWithAttachmentCount,
      metadata: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

