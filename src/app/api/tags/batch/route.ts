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
    const parsed = batchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { tagIds, operation, color } = parsed.data;

    // All operations are scoped to the caller's own tags. updateMany silently
    // no-ops on rows that don't match, so foreign tag IDs are ignored.
    const ownerScope = { id: { in: tagIds }, userId: session.user.id };

    if (operation === "delete") {
      // Soft delete
      const result = await prisma.tag.updateMany({
        where: ownerScope,
        data: {
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        deletedCount: result.count,
      });
    } else if (operation === "recolor") {
      if (!color) {
        return NextResponse.json(
          { error: "Color is required for recolor operation" },
          { status: 400 }
        );
      }

      const result = await prisma.tag.updateMany({
        where: ownerScope,
        data: {
          color,
        },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      });
    } else if (operation === "archive") {
      const result = await prisma.tag.updateMany({
        where: ownerScope,
        data: { isArchived: true },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      });
    } else if (operation === "unarchive") {
      const result = await prisma.tag.updateMany({
        where: ownerScope,
        data: { isArchived: false },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
      });
    } else if (operation === "favorite") {
      const result = await prisma.tag.updateMany({
        where: ownerScope,
        data: { isFavorite: true },
      });

      return NextResponse.json({
        success: true,
        updatedCount: result.count,
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
