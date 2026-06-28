import { z } from "zod";

// ============================================================================
// AI Dump Options Schema
// ============================================================================

export const aiDumpTemplateSchema = z.enum([
    "auto",
    "meeting",
    "research",
    "code",
    "code-review",
    "brainstorm",
    "lecture",
    "article",
]);

export const aiDumpToneSchema = z.enum([
    "balanced",
    "formal",
    "casual",
    "technical",
]);

export const aiDumpTogglesSchema = z.object({
    titles: z.boolean().default(true),
    tags: z.boolean().default(true),
    markdown: z.boolean().default(true),
    actions: z.boolean().default(true),
    preserveCode: z.boolean().default(true),
});

export const aiDumpOptionsSchema = z.object({
    template: aiDumpTemplateSchema.default("auto"),
    // prefault (not default): applies {} as input so the nested field defaults
    // fill in. default() is typed against the full output type in Zod v4.
    toggles: aiDumpTogglesSchema.prefault({}),
    tone: aiDumpToneSchema.default("balanced"),
    temperature: z.number().min(0).max(1).default(0.2),
});

// ============================================================================
// Request Schemas
// ============================================================================

export const createAIDumpSchema = z
    .object({
        content: z.string().min(1).optional(),
        fileRefs: z.array(z.string()).optional(),
        source: z
            .enum(["webclipper", "upload", "clipboard", "paste"])
            .default("paste"),
        options: aiDumpOptionsSchema.prefault({}),
        metadata: z
            .object({
                originalFilename: z.string().optional(),
                timestamp: z.string().datetime().optional(),
            })
            .optional(),
    })
    .refine((data) => data.content || (data.fileRefs?.length ?? 0) > 0, {
        message: "Either content or fileRefs must be provided",
    });

export const regenerateSectionSchema = z.object({
    section: z.enum(["titles", "tags", "markdown", "actions"]),
    options: z
        .object({
            temperature: z.number().min(0).max(1).optional(),
            tone: aiDumpToneSchema.optional(),
        })
        .optional(),
});

export const finalizeNoteSchema = z.object({
    selectedTitle: z.string().min(1, "Title is required"),
    selectedTags: z.array(z.string()),
    finalMarkdown: z.string().min(1, "Markdown content is required"),
    retainRaw: z.boolean().default(true),
});

// ============================================================================
// Response Types
// ============================================================================

export const titleVariantSchema = z.object({
    variant: z.enum(["short", "descriptive", "shareable"]),
    text: z.string(),
    score: z.number().min(0).max(1),
});

export const tagWithConfidenceSchema = z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
});

export const actionItemSchema = z.object({
    text: z.string(),
    assignee: z.string(),
    due_date: z.string().nullable(),
    confidence: z.number().min(0).max(1),
});

export const provenanceSchema = z.object({
    llm_model: z.string(),
    prompt_template_id: z.string(),
    temperature: z.number(),
    generatedAt: z.string().datetime(),
});

export const aiDumpResultSchema = z.object({
    titles: z.array(titleVariantSchema),
    tags: z.array(tagWithConfidenceSchema),
    tldr: z.string(),
    summary: z.string(),
    markdown: z.string(),
    actions: z.array(actionItemSchema),
    provenance: provenanceSchema,
});

// ============================================================================
// Structured-output schemas for the AI SDK's generateObject (replaces the old
// regex/JSON.parse extraction of LLM responses). Kept lenient (min lengths,
// not exact counts) so a slightly off-count response still parses.
// ============================================================================

export const titleTagsTldrSchema = z.object({
    titles: z.array(titleVariantSchema).min(1),
    tags: z.array(tagWithConfidenceSchema),
    tldr: z.string(),
});

export const actionsSchema = z.object({
    actions: z.array(actionItemSchema),
});

export const tagSuggestionsSchema = z.object({
    suggestions: z.array(
        z.object({
            name: z.string(),
            confidence: z.number().min(0).max(1).default(0.5),
            reason: z.string().default("AI suggested"),
        })
    ),
});

export const summaryStructuredSchema = z.object({
    summary: z.string(),
    title: z.string().optional(),
    keywords: z.array(z.string()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AIDumpTemplate = z.infer<typeof aiDumpTemplateSchema>;
export type AIDumpTone = z.infer<typeof aiDumpToneSchema>;
export type AIDumpToggles = z.infer<typeof aiDumpTogglesSchema>;
export type AIDumpOptions = z.infer<typeof aiDumpOptionsSchema>;
export type CreateAIDumpInput = z.infer<typeof createAIDumpSchema>;
export type RegenerateSectionInput = z.infer<typeof regenerateSectionSchema>;
export type FinalizeNoteInput = z.infer<typeof finalizeNoteSchema>;
export type TitleVariant = z.infer<typeof titleVariantSchema>;
export type TagWithConfidence = z.infer<typeof tagWithConfidenceSchema>;
export type ActionItem = z.infer<typeof actionItemSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type AIDumpResult = z.infer<typeof aiDumpResultSchema>;
