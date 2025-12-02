import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers as nextHeaders } from "next/headers";

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
    // Get all notes that have this tag and belong to the user
    const notesWithTag = await prisma.note.findMany({
      where: {
        userId: session.user.id,
        tags: { 
          some: { 
            id,
            userId: session.user.id,
          } 
        },
      },
      include: {
        tags: { select: { id: true } },
      },
    });

    // Count co-occurrences of other tags
    const tagCounts: Record<string, number> = {};
    
    for (const note of notesWithTag) {
      for (const tag of note.tags) {
        if (tag.id !== id) {
          tagCounts[tag.id] = (tagCounts[tag.id] || 0) + 1;
        }
      }
    }

    // Get the related tags with their counts
    const relatedTagIds = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tagId]) => tagId);

    const relatedTags = await prisma.tag.findMany({
      where: { 
        id: { in: relatedTagIds },
        userId: session.user.id,
      },
    });

    // Combine tags with their strength
    const relatedTagsWithStrength = relatedTags.map((tag) => ({
      tag,
      strength: tagCounts[tag.id],
    }));

    return NextResponse.json({
      success: true,
      relatedTags: relatedTagsWithStrength,
    });
  } catch (error) {
    console.error("Error fetching related tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch related tags" },
      { status: 500 }
    );
  }
}
