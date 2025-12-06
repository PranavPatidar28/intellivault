/**
 * Embedding Sync Service
 *
 * Orchestrates the embedding pipeline:
 * 1. Reads notes from Postgres
 * 2. Chunks text and upserts to Pinecone
 * 3. Updates embedding status in Prisma
 */

import prisma from "@/lib/prisma";
import { EmbeddingStatus } from "@/generated/prisma/client";
import {
  upsertNoteChunks,
  deleteNoteVectors,
  type UpsertResult,
} from "./pinecone-service";

// Result types
export interface EmbedNoteResult {
  noteId: string;
  status: "success" | "error" | "skipped";
  chunkCount?: number;
  error?: string;
}

export interface ProcessQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: EmbedNoteResult[];
}

export interface QueueStatus {
  pending: number;
  processing: number;
  ready: number;
  error: number;
  total: number;
}

/**
 * Embed a single note
 *
 * 1. Sets status to PROCESSING
 * 2. Deletes old vectors if any exist
 * 3. Chunks and upserts new vectors
 * 4. Updates status to READY (or ERROR)
 */
export async function embedNote(noteId: string): Promise<EmbedNoteResult> {
  // Fetch the note
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: { tags: true },
  });

  if (!note) {
    return {
      noteId,
      status: "error",
      error: "Note not found",
    };
  }

  // Skip if already being processed
  if (note.embeddingStatus === EmbeddingStatus.PROCESSING) {
    return {
      noteId,
      status: "skipped",
      error: "Note is already being processed",
    };
  }

  try {
    // Mark as processing
    await prisma.note.update({
      where: { id: noteId },
      data: { embeddingStatus: EmbeddingStatus.PROCESSING },
    });

    // Delete existing vectors if any
    if (note.chunkCount && note.chunkCount > 0) {
      await deleteNoteVectors(noteId, note.userId, note.chunkCount);
    }

    // Get tag names for metadata
    const tagNames = note.tags.map((t) => t.name);

    // Upsert new chunks
    const result: UpsertResult = await upsertNoteChunks(
      noteId,
      note.userId,
      note.title,
      note.contentText,
      tagNames
    );

    if (!result.success) {
      // Mark as error
      await prisma.note.update({
        where: { id: noteId },
        data: { embeddingStatus: EmbeddingStatus.ERROR },
      });

      return {
        noteId,
        status: "error",
        error: result.error,
      };
    }

    // Mark as ready
    await prisma.note.update({
      where: { id: noteId },
      data: {
        embeddingStatus: EmbeddingStatus.READY,
        lastEmbeddedAt: new Date(),
        chunkCount: result.chunkCount,
      },
    });

    return {
      noteId,
      status: "success",
      chunkCount: result.chunkCount,
    };
  } catch (error) {
    console.error(`Error embedding note ${noteId}:`, error);

    // Try to mark as error
    try {
      await prisma.note.update({
        where: { id: noteId },
        data: { embeddingStatus: EmbeddingStatus.ERROR },
      });
    } catch {
      // Ignore update error
    }

    return {
      noteId,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process the embedding queue
 *
 * Finds notes with PENDING or ERROR status and embeds them.
 */
export async function processEmbeddingQueue(
  limit: number = 10,
  userId?: string
): Promise<ProcessQueueResult> {
  // Find notes that need embedding
  const notes = await prisma.note.findMany({
    where: {
      embeddingStatus: {
        in: [EmbeddingStatus.PENDING, EmbeddingStatus.ERROR],
      },
      ...(userId && { userId }),
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results: EmbedNoteResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const note of notes) {
    const result = await embedNote(note.id);
    results.push(result);

    if (result.status === "success") {
      succeeded++;
    } else if (result.status === "error") {
      failed++;
    }
  }

  return {
    processed: notes.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Mark a note as needing re-embedding
 *
 * Call this when a note is updated.
 */
export async function markNoteForReembedding(noteId: string): Promise<void> {
  await prisma.note.update({
    where: { id: noteId },
    data: { embeddingStatus: EmbeddingStatus.PENDING },
  });
}

/**
 * Handle note deletion
 *
 * Removes vectors from Pinecone and marks the note.
 */
export async function handleNoteDeleted(
  noteId: string,
  userId: string,
  chunkCount?: number
): Promise<void> {
  try {
    await deleteNoteVectors(noteId, userId, chunkCount);
  } catch (error) {
    console.error(`Error deleting vectors for note ${noteId}:`, error);
  }
}

/**
 * Get embedding queue status
 */
export async function getQueueStatus(userId?: string): Promise<QueueStatus> {
  const where = userId ? { userId } : {};

  const [pending, processing, ready, error, total] = await Promise.all([
    prisma.note.count({
      where: { ...where, embeddingStatus: EmbeddingStatus.PENDING },
    }),
    prisma.note.count({
      where: { ...where, embeddingStatus: EmbeddingStatus.PROCESSING },
    }),
    prisma.note.count({
      where: { ...where, embeddingStatus: EmbeddingStatus.READY },
    }),
    prisma.note.count({
      where: { ...where, embeddingStatus: EmbeddingStatus.ERROR },
    }),
    prisma.note.count({ where }),
  ]);

  return { pending, processing, ready, error, total };
}

/**
 * Re-embed all notes for a user
 *
 * Marks all notes as PENDING for re-processing.
 */
export async function reembedAllNotes(userId: string): Promise<number> {
  const result = await prisma.note.updateMany({
    where: { userId },
    data: { embeddingStatus: EmbeddingStatus.PENDING },
  });

  return result.count;
}
