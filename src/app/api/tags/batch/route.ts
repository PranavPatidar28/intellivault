import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";
import { z } from "zod";

const batchSchema = z.object({
  tagIds: z.array(z.string()).min(1),
  operation: z.enum(["delete", "recolor", "archive", "unarchive", "favorite"]),
  color: z.string().optional(),
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
    const { tagIds, operation, color } = batchSchema.parse(body);

    if (operation === "delete") {
      // Soft delete
      await prisma.tag.updateMany({
        where: {
          id: { in: tagIds },
        },
        data: {
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        deletedCount: tagIds.length,
      });
    } else if (operation === "recolor") {
      if (!color) {
        return NextResponse.json(
          { error: "Color is required for recolor operation" },
          { status: 400 }
        );
      }

      await prisma.tag.updateMany({
        where: {
          id: { in: tagIds },
        },
        data: {
          color,
        },
      });

      return NextResponse.json({
        success: true,
        updatedCount: tagIds.length,
      });
    } else if (operation === "archive") {
      await prisma.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { isArchived: true },
      });

      return NextResponse.json({
        success: true,
        updatedCount: tagIds.length,
      });
    } else if (operation === "unarchive") {
      await prisma.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { isArchived: false },
      });

      return NextResponse.json({
        success: true,
        updatedCount: tagIds.length,
      });
    } else if (operation === "favorite") {
      await prisma.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { isFavorite: true },
      });

      return NextResponse.json({
        success: true,
        updatedCount: tagIds.length,
      });
    }

    return NextResponse.json(
      { error: "Invalid operation" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in batch operation:", error);
    return NextResponse.json(
      { error: "Failed to perform batch operation" },
      { status: 500 }
    );
  }
}
