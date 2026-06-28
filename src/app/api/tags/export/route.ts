import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";

const exportSchema = z.object({
  format: z.enum(["json", "csv"]),
  tagIds: z.array(z.string()).max(5000).optional(),
  includeArchived: z.boolean().optional().default(false),
  includeDeleted: z.boolean().optional().default(false),
});

// Escape a value for CSV: wrap in quotes, double embedded quotes, and neutralize
// formula-injection prefixes (=, +, -, @) that spreadsheet apps would execute.
function csvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  const sanitized = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = exportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { format, tagIds, includeArchived, includeDeleted } = parsed.data;

    // Scope every export to the caller's own tags so attacker-supplied tagIds
    // from other tenants can never be returned.
    const where: Prisma.TagWhereInput = { userId: session.user.id };
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
          csvCell(tag.name),
          csvCell(tag.slug),
          csvCell(tag.color),
          csvCell(tag.description),
          csvCell(tag.parent?.name),
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
