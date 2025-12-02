import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "10");
    const page = parseInt(searchParams.get("page") || "1");
    const sort = searchParams.get("sort") || "usageCount";
    const order = searchParams.get("order") || "desc";
    const showDeleted = searchParams.get("deleted") === "true";
    const favorites = searchParams.get("favorites") === "true";
    const archived = searchParams.get("archived") === "true";
    const orphaned = searchParams.get("orphaned") === "true";

    const skip = (page - 1) * limit;

    const where: any = {
      userId: session.user.id,
      deletedAt: showDeleted ? undefined : null,
    };

    if (q) {
      where.name = {
        contains: q,
        mode: "insensitive",
      };
    }

    if (favorites) {
      where.isFavorite = true;
    }

    if (archived) {
      where.isArchived = true;
    }

    if (orphaned) {
      where.notes = { none: {} };
    }

    let orderBy: any = {};
    if (sort === "usageCount") {
      orderBy = { notes: { _count: order } };
    } else {
      orderBy = { [sort]: order };
    }

    const [tags, total] = await prisma.$transaction([
      prisma.tag.findMany({
        where,
        take: limit,
        skip,
        include: {
          _count: {
            select: { notes: true },
          },
        },
        orderBy,
      }),
      prisma.tag.count({ where }),
    ]);

    const formattedTags = tags.map((tag) => ({
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
    }));

    return NextResponse.json({
      success: true,
      tags: formattedTags,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch tags" },
      { status: 500 }
    );
  }
}
