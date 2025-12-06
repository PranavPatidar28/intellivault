/**
 * Semantic Search API Route
 *
 * GET /api/notes/search?q=<query>&limit=<n>
 *
 * Searches notes using semantic similarity via Pinecone.
 */

import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { searchNotes, checkPineconeHealth } from "@/lib/ai/pinecone-service";

// Query params schema
const searchQuerySchema = z.object({
  q: z.string().min(1, "Query is required").max(500, "Query too long"),
  limit: z.preprocess(
    (val) => (val === null || val === "" ? undefined : Number(val)),
    z.number().int().positive().max(50).optional().default(10)
  ),
  includeContent: z.coerce.boolean().optional().default(false),
});

// Response types
interface SearchResultNote {
  id: string;
  title: string;
  preview: string;
  score: number;
  matchedChunk: string;
  chunkIndex: number;
  tags: { id: string; name: string; color: string | null }[];
  createdAt: Date;
  updatedAt: Date;
  contentText?: string;
}

/**
 * GET /api/notes/search
 *
 * Semantic search across user's notes
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if Pinecone is configured
    const health = await checkPineconeHealth();
    if (!health.configured) {
      return NextResponse.json(
        {
          error: "Semantic search is not configured",
          details: "Pinecone environment variables are not set",
        },
        { status: 503 }
      );
    }

    if (!health.accessible) {
      return NextResponse.json(
        {
          error: "Semantic search is temporarily unavailable",
          details: health.error,
        },
        { status: 503 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const result = searchQuerySchema.safeParse({
      q: searchParams.get("q"),
      limit: searchParams.get("limit"),
      includeContent: searchParams.get("includeContent"),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 }
      );
    }

    const { q, limit, includeContent } = result.data;

    // Search in Pinecone
    const searchResults = await searchNotes(session.user.id, q, limit);

    if (searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        query: q,
        results: [],
        total: 0,
      });
    }

    // Get unique note IDs (a note may appear multiple times for different chunks)
    const noteIds = [...new Set(searchResults.map((r) => r.noteId))];

    // Fetch full note data from Prisma
    const notes = await prisma.note.findMany({
      where: {
        id: { in: noteIds },
        userId: session.user.id, // Extra security check
      },
      select: {
        id: true,
        title: true,
        contentText: includeContent,
        tags: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create a map for quick lookup
    const noteMap = new Map(notes.map((n) => [n.id, n]));

    // Build response with best match per note
    const seenNotes = new Set<string>();
    const responseResults: SearchResultNote[] = [];

    for (const searchResult of searchResults) {
      // Skip if we've already included this note (keep highest score)
      if (seenNotes.has(searchResult.noteId)) {
        continue;
      }
      seenNotes.add(searchResult.noteId);

      const note = noteMap.get(searchResult.noteId);
      if (!note) continue; // Note might have been deleted

      responseResults.push({
        id: note.id,
        title: note.title,
        preview: searchResult.preview,
        score: searchResult.score,
        matchedChunk: searchResult.chunkText,
        chunkIndex: searchResult.chunkIndex,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        ...(includeContent && { contentText: note.contentText }),
      });
    }

    return NextResponse.json({
      success: true,
      query: q,
      results: responseResults,
      total: responseResults.length,
    });
  } catch (error) {
    console.error("Error in semantic search:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
