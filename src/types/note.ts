/**
 * Shared TypeScript types for notes functionality
 */

import { JSONContent } from "@tiptap/core";

/**
 * Note entity from database
 */
export interface Note {
  id: string;
  title: string;
  generatedTitle?: string | null;
  summary?: string | null;
  contentJSON: JSONContent;
  contentText: string;
  tags: { id: string; name: string; color: string | null }[];
  createdAt: string | Date;
  updatedAt: string | Date;
  userId?: string;
  isPinned?: boolean;
  pinnedAt?: string | Date | null;
  attachmentCount?: number;
}

/**
 * Input for creating a new note
 */
export interface NoteCreateInput {
  title: string;
  contentJSON: JSONContent;
  contentText: string;
  tags?: string[];
}

/**
 * Input for updating an existing note
 */
export interface NoteUpdateInput {
  title?: string;
  contentJSON?: JSONContent;
  contentText?: string;
  tags?: string[];
}

/**
 * API response for fetching multiple notes
 */
export interface NotesResponse {
  success: boolean;
  notes?: Note[];
  error?: string;
}

/**
 * API response for fetching/creating/updating a single note
 */
export interface NoteResponse {
  success: boolean;
  note?: Note;
  error?: string;
}

/**
 * API response for deleting a note
 */
export interface DeleteNoteResponse {
  success: boolean;
  error?: string;
}

// ============================================
// Semantic Search Types
// ============================================

/**
 * Embedding status values (mirrors Prisma enum)
 */
export type EmbeddingStatusType = "PENDING" | "PROCESSING" | "READY" | "ERROR" | "DELETED";

/**
 * Note with embedding metadata
 */
export interface NoteWithEmbedding extends Note {
  embeddingStatus: EmbeddingStatusType;
  lastEmbeddedAt?: string | Date | null;
  chunkCount?: number | null;
}

/**
 * Semantic search result for a single note
 */
export interface SemanticSearchResult {
  id: string;
  title: string;
  preview: string;
  score: number;
  matchedChunk: string;
  chunkIndex: number;
  tags: { id: string; name: string; color: string | null }[];
  createdAt: string | Date;
  updatedAt: string | Date;
  contentText?: string;
}

/**
 * API response for semantic search
 */
export interface SemanticSearchResponse {
  success: boolean;
  query: string;
  results: SemanticSearchResult[];
  total: number;
  error?: string;
}

/**
 * Embedding queue status
 */
export interface EmbeddingQueueStatus {
  pending: number;
  processing: number;
  ready: number;
  error: number;
  total: number;
}

/**
 * API response for embedding status
 */
export interface EmbeddingStatusResponse {
  success: boolean;
  pinecone: {
    configured: boolean;
    accessible: boolean;
    error?: string;
  };
  queue: EmbeddingQueueStatus;
}

/**
 * Result of embedding a single note
 */
export interface EmbedNoteResult {
  noteId: string;
  status: "success" | "error" | "skipped";
  chunkCount?: number;
  error?: string;
}

/**
 * API response for embedding operation
 */
export interface EmbedResponse {
  success: boolean;
  result?: EmbedNoteResult;
  processed?: number;
  succeeded?: number;
  failed?: number;
  results?: EmbedNoteResult[];
  message?: string;
  count?: number;
  error?: string;
}
