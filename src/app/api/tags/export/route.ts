import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";

const exportSchema = z.object({
  format: z.enum(["json", "csv"]),
  tagIds: z.array(z.string()).optional(),
  includeArchived: z.boolean().optional().default(false),
  includeDeleted: z.boolean().optional().default(false),
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
    const { format, tagIds, includeArchived, includeDeleted } =
      exportSchema.parse(body);

    // Build where clause
    const where: any = {};
    if (tagIds && tagIds.length > 0) {
      where.id = { in: tagIds };
    }
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    if (!includeArchived) {
      where.isArchived = false;
    }

    // Fetch tags
    const tags = await prisma.tag.findMany({
      where,
      include: {
        _count: { select: { notes: true } },
        parent: { select: { id: true, name: true } },
      },
    });

    if (format === "json") {
      const exportData = tags.map((tag) => ({
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        description: tag.description,
        parentName: tag.parent?.name || null,
        isFavorite: tag.isFavorite,
        isArchived: tag.isArchived,
        usageCount: tag._count.notes,
        createdAt: tag.createdAt,
      }));

      return NextResponse.json({
        success: true,
        data: JSON.stringify(exportData, null, 2),
        filename: `tags-export-${new Date().toISOString().split("T")[0]}.json`,
      });
    } else {
      // CSV format
      const headers = [
        "Name",
        "Slug",
        "Color",
        "Description",
        "Parent",
        "Favorite",
        "Archived",
        "Usage Count",
        "Created At",
      ].join(",");

      const rows = tags.map((tag) =>
        [
          `"${tag.name}"`,
          `"${tag.slug}"`,
          `"${tag.color || ""}"`,
          `"${tag.description || ""}"`,
          `"${tag.parent?.name || ""}"`,
          tag.isFavorite,
          tag.isArchived,
          tag._count.notes,
          tag.createdAt.toISOString(),
        ].join(",")
      );

      const csvData = [headers, ...rows].join("\n");

      return NextResponse.json({
        success: true,
        data: csvData,
        filename: `tags-export-${new Date().toISOString().split("T")[0]}.csv`,
      });
    }
  } catch (error) {
    console.error("Error exporting tags:", error);
    return NextResponse.json(
      { error: "Failed to export tags" },
      { status: 500 }
    );
  }
}
