/**
 * Embedding API Routes
 *
 * POST /api/notes/embed - Trigger embedding for notes
 * GET /api/notes/embed - Get embedding queue status
 */

import { NextRequest, NextResponse } from "next/server";
import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";
import {
  embedNote,
  processEmbeddingQueue,
  getQueueStatus,
  reembedAllNotes,
} from "@/lib/ai/embedding-sync";
import { checkPineconeHealth } from "@/lib/ai/pinecone-service";

// Request body schema
const embedRequestSchema = z.object({
  // Embed a specific note
  noteId: z.string().optional(),
  // Process the queue
  processQueue: z.boolean().optional(),
  // Limit for queue processing
  limit: z.number().int().positive().max(50).optional().default(10),
  // Re-embed all notes
  reembedAll: z.boolean().optional(),
});

/**
 * POST /api/notes/embed
 *
 * Trigger embedding operations:
 * - { noteId: "..." } - Embed a specific note
 * - { processQueue: true, limit?: 10 } - Process pending notes
 * - { reembedAll: true } - Mark all notes for re-embedding
 */
export async function POST(request: NextRequest) {
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
          error: "Pinecone is not configured",
          details: health.error,
        },
        { status: 503 }
      );
    }

    const json = await request.json();
    const result = embedRequestSchema.safeParse(json);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.issues },
        { status: 400 }
      );
    }

    const { noteId, processQueue, limit, reembedAll } = result.data;

    // Re-embed all notes
    if (reembedAll) {
      const count = await reembedAllNotes(session.user.id);
      return NextResponse.json({
        success: true,
        message: `Marked ${count} notes for re-embedding`,
        count,
      });
    }

    // Embed a specific note
    if (noteId) {
      const embedResult = await embedNote(noteId);
      return NextResponse.json({
        success: embedResult.status === "success",
        result: embedResult,
      });
    }

    // Process the queue
    if (processQueue) {
      const queueResult = await processEmbeddingQueue(limit, session.user.id);
      return NextResponse.json({
        success: true,
        ...queueResult,
      });
    }

    return NextResponse.json(
      { error: "No action specified" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in embed API:", error);
    return NextResponse.json(
      { error: "Failed to process embedding request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notes/embed
 *
 * Get embedding queue status and health
 */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await nextHeaders(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [health, status] = await Promise.all([
      checkPineconeHealth(),
      getQueueStatus(session.user.id),
    ]);

    return NextResponse.json({
      success: true,
      pinecone: health,
      queue: status,
    });
  } catch (error) {
    console.error("Error getting embed status:", error);
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    );
  }
}
