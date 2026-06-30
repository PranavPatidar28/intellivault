import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import { slugify } from "@/lib/utils/text";
import { Prisma } from "@/generated/prisma";

const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(50).optional(),
  description: z.string().max(500).nullish(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// Prisma throws P2025 when an update/delete matches no row (e.g. wrong id or
// not owned by this user). Surface that as 404 rather than a generic 500.
function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

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
    const body = await request.json();
    const parsed = updateTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const validated = parsed.data;

    const updateData: Prisma.TagUpdateInput = {};
    if (validated.name) {
      updateData.name = validated.name;
      updateData.slug = slugify(validated.name);
    }
    if (validated.color !== undefined) {
      updateData.color = validated.color;
    }
    if (validated.description !== undefined) {
      updateData.description = validated.description;
    }
    if (validated.isFavorite !== undefined) {
      updateData.isFavorite = validated.isFavorite;
    }
    if (validated.isArchived !== undefined) {
      updateData.isArchived = validated.isArchived;
    }

    const tag = await prisma.tag.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: updateData,
      include: {
        _count: {
          select: { notes: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        description: tag.description,
        isFavorite: tag.isFavorite,
        isArchived: tag.isArchived,
        usageCount: tag._count.notes,
        lastUsed: tag.lastUsed,
        createdAt: tag.createdAt,
        deletedAt: tag.deletedAt,
      },
    });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    console.error("Error updating tag:", error);
    return NextResponse.json(
      { error: "Failed to update tag" },
      { status: 500 }
    );
  }
}

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
    // Soft delete by setting deletedAt
    const tag = await prisma.tag.update({
      where: {
        id,
        userId: session.user.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      tag,
    });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }
    console.error("Error deleting tag:", error);
    return NextResponse.json(
      { error: "Failed to delete tag" },
      { status: 500 }
    );
  }
}

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
    const tag = await prisma.tag.findFirst({
      where: { 
        id,
        userId: session.user.id,
      },
      include: {
        _count: {
          select: { notes: true },
        },
        notes: {
          take: 10,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            title: true,
            contentText: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        description: tag.description,
        isFavorite: tag.isFavorite,
        isArchived: tag.isArchived,
        usageCount: tag._count.notes,
        lastUsed: tag.lastUsed,
        createdAt: tag.createdAt,
        deletedAt: tag.deletedAt,
        notes: tag.notes,
      },
    });
  } catch (error) {
    console.error("Error fetching tag:", error);
    return NextResponse.json(
      { error: "Failed to fetch tag" },
      { status: 500 }
    );
  }
}
