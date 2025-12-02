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
  contentJSON: JSONContent;
  contentText: string;
  tags: { id: string; name: string; color: string | null }[];
  createdAt: string | Date;
  updatedAt: string | Date;
  userId?: string;
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
