/**
 * Pinecone Service
 *
 * CRUD operations for note embeddings using Pinecone's integrated embedding.
 * Pinecone automatically converts text to vectors - no external embedding API needed.
 */

import {
  getNotesIndex,
  getUserNamespace,
  getChunkId,
  type ChunkRecord,
  type SearchHit,
} from "./pinecone";
import { chunkText, getPreview, type TextChunk } from "./chunker";

// Search result interface
export interface SemanticSearchResult {
  noteId: string;
  score: number;
  chunkText: string;
  chunkIndex: number;
  title: string;
  preview: string;
  tags: string[];
}

// Upsert result interface
export interface UpsertResult {
  noteId: string;
  chunkCount: number;
  success: boolean;
  error?: string;
}

/**
 * Upsert note chunks into Pinecone
 *
 * Chunks the note text and upserts each chunk as a record.
 * Pinecone automatically embeds the chunk_text field.
 */
export async function upsertNoteChunks(
  noteId: string,
  userId: string,
  title: string,
  content: string,
  tags: string[]
): Promise<UpsertResult> {
  try {
    const index = getNotesIndex();
    const namespace = getUserNamespace(userId);

    // Chunk the content (include title for better context)
    // We prepend the title so it's included in the first chunk(s)
    const fullText = `${title}\n\n${content}`;
    const chunks = chunkText(fullText);

    if (chunks.length === 0) {
      return {
        noteId,
        chunkCount: 0,
        success: true,
      };
    }

    // Build records for upsert
    const now = new Date().toISOString();
    const records: ChunkRecord[] = chunks.map((chunk: TextChunk) => ({
      _id: getChunkId(noteId, chunk.index),
      chunk_text: chunk.text, // This field is auto-embedded by Pinecone
      noteId,
      chunkIndex: chunk.index,
      userId,
      title: title || "Untitled",
      preview: getPreview(chunk.text),
      tags,
      updatedAt: now,
    }));

    // Upsert records using integrated embedding API
    // The index.upsertRecords method sends text that Pinecone embeds automatically
    await index.namespace(namespace).upsertRecords(records);

    return {
      noteId,
      chunkCount: chunks.length,
      success: true,
    };
  } catch (error) {
    console.error(`Error upserting chunks for note ${noteId}:`, error);
    return {
      noteId,
      chunkCount: 0,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete all vectors for a note from Pinecone
 *
 * Uses prefix-based deletion to remove all chunks for a note.
 */
export async function deleteNoteVectors(
  noteId: string,
  userId: string,
  chunkCount?: number
): Promise<boolean> {
  try {
    const index = getNotesIndex();
    const namespace = getUserNamespace(userId);

    // If we know the chunk count, delete by specific IDs
    if (chunkCount !== undefined && chunkCount > 0) {
      const ids = Array.from({ length: chunkCount }, (_, i) =>
        getChunkId(noteId, i)
      );
      await index.namespace(namespace).deleteMany(ids);
    } else {
      // Delete by ID prefix (all chunks for this note)
      // Note: This requires the index to support prefix deletion
      // Fall back to fetching and deleting if needed
      const prefix = `${noteId}_chunk_`;

      // Try to delete by prefix filter
      await index.namespace(namespace).deleteMany({
        filter: {
          noteId: { $eq: noteId },
          userId: { $eq: userId }, // Ensure we only delete this user's data
        },
      });
    }

    return true;
  } catch (error) {
    console.error(`Error deleting vectors for note ${noteId}:`, error);
    return false;
  }
}

/**
 * Semantic search across user's notes
 *
 * Searches using text query - Pinecone automatically embeds the query.
 */
export async function searchNotes(
  userId: string,
  query: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  try {
    const index = getNotesIndex();
    const namespace = getUserNamespace(userId);

    // Search using text query - Pinecone embeds automatically
    const response = await index.namespace(namespace).searchRecords({
      query: {
        inputs: { text: query },
        topK: limit,
        // Filter by userId to ensure data isolation in shared namespace
        filter: { userId: { $eq: userId } },
      },
      fields: ["noteId", "chunkIndex", "chunk_text", "title", "preview", "tags"],
    });

    // Map response to our interface
    const results: SemanticSearchResult[] = [];

    if (response.result?.hits) {
      for (const hit of response.result.hits as SearchHit[]) {
        results.push({
          noteId: hit.fields.noteId,
          score: hit._score,
          chunkText: hit.fields.chunk_text,
          chunkIndex: hit.fields.chunkIndex,
          title: hit.fields.title,
          preview: hit.fields.preview,
          tags: hit.fields.tags || [],
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error searching notes:", error);
    throw error;
  }
}

/**
 * Check if Pinecone is configured and accessible
 */
export async function checkPineconeHealth(): Promise<{
  configured: boolean;
  accessible: boolean;
  error?: string;
}> {
  try {
    const index = getNotesIndex();
    // Try to get index stats as a health check
    await index.describeIndexStats();
    return { configured: true, accessible: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not set")) {
      return { configured: false, accessible: false, error: error.message };
    }
    return {
      configured: true,
      accessible: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
