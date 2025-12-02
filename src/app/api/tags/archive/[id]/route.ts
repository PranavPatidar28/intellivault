import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";

export async function POST(
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
    // Get current archive status
    const tag = await prisma.tag.findFirst({
      where: { 
        id,
        userId: session.user.id,
      },
      select: { isArchived: true },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Toggle archive
    const updatedTag = await prisma.tag.update({
      where: { 
        id,
        userId: session.user.id,
      },
      data: { isArchived: !tag.isArchived },
    });

    return NextResponse.json({
      success: true,
      tag: updatedTag,
      isArchived: updatedTag.isArchived,
    });
  } catch (error) {
    console.error("Error toggling archive:", error);
    return NextResponse.json(
      { error: "Failed to toggle archive" },
      { status: 500 }
    );
  }
}
