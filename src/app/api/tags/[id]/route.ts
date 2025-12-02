import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import { slugify } from "@/lib/utils/text";

const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

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
    const validated = updateTagSchema.parse(body);

    const updateData: any = {};
    if (validated.name) {
      updateData.name = validated.name;
      updateData.slug = slugify(validated.name);
    }
    if (validated.color !== undefined) {
      updateData.color = validated.color;
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
        usageCount: tag._count.notes,
        lastUsed: tag.lastUsed,
        createdAt: tag.createdAt,
        deletedAt: tag.deletedAt,
      },
    });
  } catch (error) {
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
