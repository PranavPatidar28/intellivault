import { z } from "zod";

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  contentJSON: z.any().optional(), // Allow any JSON content for TipTap
  contentText: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long").optional(),
  contentJSON: z.any().optional(),
  contentText: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const noteQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type NoteQueryInput = z.infer<typeof noteQuerySchema>;
