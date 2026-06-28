import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";

const tagQuerySchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  page: z.coerce.number().int().min(1).default(1),
  sort: z
    .enum(["usageCount", "name", "createdAt", "lastUsed", "updatedAt"])
    .default("usageCount"),
  order: z.enum(["asc", "desc"]).default("desc"),
  // Query-string booleans: only the literal "true" is truthy (matching the
  // prior `=== "true"` behavior). z.coerce.boolean() would treat "false" as
  // true since it is a non-empty string.
  deleted: z.string().optional().transform((v) => v === "true"),
  favorites: z.string().optional().transform((v) => v === "true"),
  archived: z.string().optional().transform((v) => v === "true"),
  orphaned: z.string().optional().transform((v) => v === "true"),
});

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = tagQuerySchema.safeParse(
      Object.fromEntries(searchParams.entries())
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      q,
      limit,
      page,
      sort,
      order,
      deleted: showDeleted,
      favorites,
      archived,
      orphaned,
    } = parsed.data;

    const skip = (page - 1) * limit;

    const where: Prisma.TagWhereInput = {
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

    const orderBy: Prisma.TagOrderByWithRelationInput =
      sort === "usageCount"
        ? { notes: { _count: order } }
        : { [sort]: order };

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
