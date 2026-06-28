import { z } from "zod";

// Bounds to keep persisted free-text and JSON from growing unbounded (memory
// pressure on request parsing + unbounded DB row growth).
const MAX_CONTENT_TEXT = 500_000; // ~500 KB of plain text
const MAX_CONTENT_JSON_BYTES = 2_000_000; // ~2 MB serialized TipTap doc
const MAX_TAGS = 50;
const MAX_TAG_LENGTH = 50;

// TipTap document: accept arbitrary JSON but bound its serialized size.
const boundedContentJSON = z
  .any()
  .refine(
    (v) => v === undefined || JSON.stringify(v).length <= MAX_CONTENT_JSON_BYTES,
    { message: "Note content is too large" }
  );

const tagsSchema = z
  .array(z.string().min(1).max(MAX_TAG_LENGTH))
  .max(MAX_TAGS, `A note can have at most ${MAX_TAGS} tags`);

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  contentJSON: boundedContentJSON.optional(), // Allow any JSON content for TipTap
  contentText: z.string().max(MAX_CONTENT_TEXT).optional(),
  tags: tagsSchema.optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long").optional(),
  contentJSON: boundedContentJSON.optional(),
  contentText: z.string().max(MAX_CONTENT_TEXT).optional(),
  tags: tagsSchema.optional(),
});

export const noteQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteQueryInput = z.infer<typeof noteQuerySchema>;
