/**
 * Pinecone Client Singleton
 *
 * Provides a configured Pinecone client for vector operations.
 * Uses integrated embedding - Pinecone automatically converts text to vectors.
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "@/env";

// Type for record metadata stored in Pinecone
export interface ChunkMetadata {
  noteId: string;
  chunkIndex: number;
  userId: string;
  title: string;
  preview: string;
  tags: string[];
  updatedAt: string;
}

// Type for a record to upsert (with text for embedding)
// Index signature required for Pinecone RecordMetadata compatibility
export interface ChunkRecord {
  [key: string]: string | number | string[];
  _id: string;
  chunk_text: string; // This field is auto-embedded by Pinecone
  noteId: string;
  chunkIndex: number;
  userId: string;
  title: string;
  preview: string;
  tags: string[];
  updatedAt: string;
}

// Type for search result hit
export interface SearchHit {
  _id: string;
  _score: number;
  fields: {
    noteId: string;
    chunkIndex: number;
    chunk_text: string;
    title: string;
    preview: string;
    tags: string[];
    updatedAt: string;
  };
}

// Singleton instance
let pineconeClient: Pinecone | null = null;

// Get the Pinecone client singleton
export function getPinecone(): Pinecone {
  if (!env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY environment variable is not set");
  }

  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
  }

  return pineconeClient;
}

// Get the Pinecone index for notes
// Uses the index name and host URL from environment
export function getNotesIndex() {
  if (!env.PINECONE_INDEX_HOST) {
    throw new Error("PINECONE_INDEX_HOST environment variable is not set");
  }

  if (!env.PINECONE_INDEX_NAME) {
    throw new Error("PINECONE_INDEX_NAME environment variable is not set");
  }

  const pc = getPinecone();

  // Use index name with host URL to connect directly
  return pc.index(env.PINECONE_INDEX_NAME, env.PINECONE_INDEX_HOST);
}

// Generate a namespace for a user
// We use a single namespace 'notes' and filter by userId metadata
// This enables better multi-tenancy and easier index management
export function getUserNamespace(_userId: string): string {
  return "notes";
}

// Generate a unique ID for a chunk
export function getChunkId(noteId: string, chunkIndex: number): string {
  return `${noteId}_chunk_${chunkIndex}`;
}

// Parse a chunk ID back to noteId and chunkIndex
export function parseChunkId(chunkId: string): { noteId: string; chunkIndex: number } | null {
  const match = chunkId.match(/^(.+)_chunk_(\d+)$/);
  if (!match) return null;
  return {
    noteId: match[1],
    chunkIndex: parseInt(match[2], 10),
  };
}
