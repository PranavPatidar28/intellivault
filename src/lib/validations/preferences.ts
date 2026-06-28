import { z } from "zod";

// Hex color like #fff or #ffffff (optional leading #).
const hexColor = z
  .string()
  .regex(/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, "Invalid color")
  .max(9);

/**
 * Strict whitelist of user-editable preference fields. `.strict()` rejects any
 * unknown key (e.g. id/userId/createdAt) so the client can never mass-assign
 * columns it shouldn't control. All fields are optional for partial updates.
 */
export const updatePreferencesSchema = z
  .object({
    // Appearance
    theme: z.enum(["light", "dark", "system"]),
    fontSize: z.enum(["small", "medium", "large"]),
    displayDensity: z.enum(["compact", "comfortable", "spacious"]),

    // AI Settings
    defaultLLMProvider: z
      .enum(["ollama", "gemini", "openai", "openrouter"])
      .nullable(),
    defaultLLMModel: z.string().max(100).nullable(),
    aiAutoSummarize: z.boolean(),
    aiAutoTag: z.boolean(),

    // Notes & Editor
    defaultNoteView: z.enum(["grid", "list"]),
    defaultSortOrder: z.enum(["updatedAt", "createdAt", "title", "title-desc"]),
    autoSaveInterval: z.number().int().min(0).max(3600),
    showWordCount: z.boolean(),
    spellCheck: z.boolean(),

    // Tags
    defaultTagColor: hexColor.nullable(),
    enableTagSuggestions: z.boolean(),

    // Privacy
    analyticsEnabled: z.boolean(),
  })
  .partial()
  .strict();

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
