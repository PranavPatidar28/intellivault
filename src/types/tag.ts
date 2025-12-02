import { z } from "zod";

// ============================================================================
// Base Tag Types
// ============================================================================

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
  parentId: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface TagWithStats extends Tag {
  usageCount: number;
  _count?: {
    notes: number;
  };
}

export interface TagHierarchy extends Tag {
  parent?: Tag | null;
  children?: Tag[];
  level?: number;
}

export interface TagWithRelations extends Tag {
  notes?: Array<{
    id: string;
    title: string;
    contentText: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  relatedTags?: Array<{
    tag: Tag;
    strength: number;
  }>;
}

// ============================================================================
// Tag View Types
// ============================================================================

export interface TagView {
  id: string;
  name: string;
  filters: TagFilters;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagFilters {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  favorites?: boolean;
  archived?: boolean;
  orphaned?: boolean;
  parentId?: string | null;
}

// ============================================================================
// Tag Analytics Types
// ============================================================================

export interface TagAnalytics {
  totalTags: number;
  activeTags: number;
  archivedTags: number;
  orphanedTags: number;
  mostUsedTags: Array<{
    tag: Tag;
    count: number;
  }>;
  usageOverTime: Array<{
    date: string;
    count: number;
  }>;
  recentlyCreated: Tag[];
  tagGrowth: {
    thisWeek: number;
    lastWeek: number;
    percentChange: number;
  };
}

// ============================================================================
// Tag Suggestions Types
// ============================================================================

export interface TagSuggestion {
  name: string;
  confidence: number;
  reason: string;
  existingTag?: Tag;
}

export interface TagSuggestionsResponse {
  suggestions: TagSuggestion[];
  relatedTags: Tag[];
}

// ============================================================================
// Tag Operations Types
// ============================================================================

export interface BulkOperationProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  status: "pending" | "processing" | "completed" | "error";
}

export interface UndoOperation {
  type: "delete" | "merge" | "update" | "bulkDelete" | "bulkUpdate";
  data: any;
  timestamp: Date;
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

export const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50, "Tag name too long"),
  color: z.string().nullable().optional(),
  description: z.string().max(500, "Description too long").nullable().optional(),
  parentId: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const tagUpdateSchema = tagSchema.partial();

export const tagFiltersSchema = z.object({
  search: z.string().optional(),
  sort: z.enum(["name", "usageCount", "createdAt", "lastUsed"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  favorites: z.boolean().optional(),
  archived: z.boolean().optional(),
  orphaned: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
});

export const bulkOperationSchema = z.object({
  tagIds: z.array(z.string()).min(1, "Select at least one tag"),
  operation: z.enum(["delete", "recolor", "archive", "unarchive", "favorite"]),
  color: z.string().optional(),
});

export const mergeTagsSchema = z.object({
  sourceTagIds: z.array(z.string()).min(1, "Select at least one source tag"),
  targetTagId: z.string(),
});

export const exportTagsSchema = z.object({
  format: z.enum(["json", "csv"]),
  tagIds: z.array(z.string()).optional(),
  includeArchived: z.boolean().optional(),
  includeDeleted: z.boolean().optional(),
});

export const importTagsSchema = z.object({
  data: z.string(),
  format: z.enum(["json", "csv"]),
  strategy: z.enum(["merge", "replace", "skip"]).optional(),
});

export const tagViewSchema = z.object({
  name: z.string().min(1, "View name is required").max(50),
  filters: tagFiltersSchema,
});

// ============================================================================
// API Response Types
// ============================================================================

export interface TagsApiResponse {
  success: boolean;
  tags: TagWithStats[];
  pagination?: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
  error?: string;
}

export interface TagApiResponse {
  success: boolean;
  tag?: TagWithRelations;
  error?: string;
}

export interface TagAnalyticsApiResponse {
  success: boolean;
  analytics?: TagAnalytics;
  error?: string;
}

export interface BulkOperationApiResponse {
  success: boolean;
  updatedCount?: number;
  deletedCount?: number;
  mergedNotesCount?: number;
  error?: string;
}

export interface ExportApiResponse {
  success: boolean;
  data?: string;
  filename?: string;
  error?: string;
}

export interface ImportApiResponse {
  success: boolean;
  imported?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
}
