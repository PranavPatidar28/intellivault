import { useState, useCallback } from "react";
import { toast } from "sonner";
import type {
  Tag,
  TagWithStats,
  TagWithRelations,
  BulkOperationProgress,
  UndoOperation,
} from "@/types/tag";

interface UseTagOperationsReturn {
  // State
  isLoading: boolean;
  error: string | null;
  progress: BulkOperationProgress | null;
  undoStack: UndoOperation[];

  // Single tag operations
  createTag: (name: string, color?: string, parentId?: string) => Promise<Tag | null>;
  updateTag: (id: string, data: Partial<Tag>) => Promise<Tag | null>;
  deleteTag: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  toggleArchive: (id: string) => Promise<boolean>;

  // Bulk operations
  bulkDelete: (tagIds: string[]) => Promise<number>;
  bulkRecolor: (tagIds: string[], color: string) => Promise<number>;
  bulkArchive: (tagIds: string[]) => Promise<number>;
  bulkFavorite: (tagIds: string[]) => Promise<number>;
  mergeTags: (sourceIds: string[], targetId: string) => Promise<number>;

  // Undo/Redo
  undo: () => Promise<boolean>;
  clearUndoStack: () => void;
}

export function useTagOperations(): UseTagOperationsReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BulkOperationProgress | null>(null);
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);

  const handleError = useCallback((err: unknown, fallbackMessage: string) => {
    const message = err instanceof Error ? err.message : fallbackMessage;
    setError(message);
    toast.error("Error", { description: message });
    return null;
  }, []);

  // ============================================================================
  // Single Tag Operations
  // ============================================================================

  const createTag = useCallback(
    async (name: string, color?: string, parentId?: string): Promise<Tag | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, color, parentId }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to create tag");
        }

        toast.success("Tag created", { description: `Created tag "${name}"` });
        return data.tag;
      } catch (err) {
        return handleError(err, "Failed to create tag");
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const updateTag = useCallback(
    async (id: string, data: Partial<Tag>): Promise<Tag | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/tags/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to update tag");
        }

        toast.success("Tag updated");
        return result.tag;
      } catch (err) {
        return handleError(err, "Failed to update tag");
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const deleteTag = useCallback(
    async (id: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/tags/${id}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to delete tag");
        }

        // Add to undo stack
        setUndoStack((prev) => [
          ...prev,
          {
            type: "delete",
            data: { tagId: id },
            timestamp: new Date(),
          },
        ]);

        toast.success("Tag deleted");
        return true;
      } catch (err) {
        handleError(err, "Failed to delete tag");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const toggleFavorite = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/tags/favorite/${id}`, {
          method: "POST",
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to toggle favorite");
        }

        return true;
      } catch (err) {
        handleError(err, "Failed to toggle favorite");
        return false;
      }
    },
    [handleError]
  );

  const toggleArchive = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/tags/archive/${id}`, {
          method: "POST",
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to toggle archive");
        }

        return true;
      } catch (err) {
        handleError(err, "Failed to toggle archive");
        return false;
      }
    },
    [handleError]
  );

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  const bulkDelete = useCallback(
    async (tagIds: string[]): Promise<number> => {
      setIsLoading(true);
      setError(null);
      setProgress({
        total: tagIds.length,
        completed: 0,
        failed: 0,
        status: "processing",
      });

      try {
        const response = await fetch("/api/tags/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagIds,
            operation: "delete",
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to delete tags");
        }

        setProgress({
          total: tagIds.length,
          completed: data.deletedCount || 0,
          failed: 0,
          status: "completed",
        });

        // Add to undo stack
        setUndoStack((prev) => [
          ...prev,
          {
            type: "bulkDelete",
            data: { tagIds },
            timestamp: new Date(),
          },
        ]);

        toast.success("Tags deleted", {
          description: `Deleted ${data.deletedCount} tag(s)`,
        });

        return data.deletedCount || 0;
      } catch (err) {
        setProgress((prev) => (prev ? { ...prev, status: "error" } : null));
        handleError(err, "Failed to delete tags");
        return 0;
      } finally {
        setIsLoading(false);
        setTimeout(() => setProgress(null), 3000);
      }
    },
    [handleError]
  );

  const bulkRecolor = useCallback(
    async (tagIds: string[], color: string): Promise<number> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/tags/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagIds,
            operation: "recolor",
            color,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to recolor tags");
        }

        toast.success("Tags recolored", {
          description: `Updated ${data.updatedCount} tag(s)`,
        });

        return data.updatedCount || 0;
      } catch (err) {
        handleError(err, "Failed to recolor tags");
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const bulkArchive = useCallback(
    async (tagIds: string[]): Promise<number> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/tags/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagIds,
            operation: "archive",
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to archive tags");
        }

        toast.success("Tags archived", {
          description: `Archived ${data.updatedCount} tag(s)`,
        });

        return data.updatedCount || 0;
      } catch (err) {
        handleError(err, "Failed to archive tags");
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const bulkFavorite = useCallback(
    async (tagIds: string[]): Promise<number> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/tags/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagIds,
            operation: "favorite",
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to favorite tags");
        }

        toast.success("Tags favorited", {
          description: `Favorited ${data.updatedCount} tag(s)`,
        });

        return data.updatedCount || 0;
      } catch (err) {
        handleError(err, "Failed to favorite tags");
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [handleError]
  );

  const mergeTags = useCallback(
    async (sourceIds: string[], targetId: string): Promise<number> => {
      setIsLoading(true);
      setError(null);
      setProgress({
        total: sourceIds.length,
        completed: 0,
        failed: 0,
        status: "processing",
      });

      try {
        const response = await fetch("/api/tags/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceTagIds: sourceIds,
            targetTagId: targetId,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to merge tags");
        }

        setProgress({
          total: sourceIds.length,
          completed: sourceIds.length,
          failed: 0,
          status: "completed",
        });

        toast.success("Tags merged", {
          description: `Merged ${sourceIds.length} tag(s), updated ${data.mergedNotesCount} note(s)`,
        });

        return data.mergedNotesCount || 0;
      } catch (err) {
        setProgress((prev) => (prev ? { ...prev, status: "error" } : null));
        handleError(err, "Failed to merge tags");
        return 0;
      } finally {
        setIsLoading(false);
        setTimeout(() => setProgress(null), 3000);
      }
    },
    [handleError]
  );

  // ============================================================================
  // Undo/Redo (Basic implementation)
  // ============================================================================

  const undo = useCallback(async (): Promise<boolean> => {
    if (undoStack.length === 0) {
      toast.info("Nothing to undo");
      return false;
    }

    const lastOperation = undoStack[undoStack.length - 1];
    // Implementation would depend on operation type
    // For now, just show a message
    toast.info("Undo functionality coming soon");
    setUndoStack((prev) => prev.slice(0, -1));
    return true;
  }, [undoStack]);

  const clearUndoStack = useCallback(() => {
    setUndoStack([]);
  }, []);

  return {
    isLoading,
    error,
    progress,
    undoStack,
    createTag,
    updateTag,
    deleteTag,
    toggleFavorite,
    toggleArchive,
    bulkDelete,
    bulkRecolor,
    bulkArchive,
    bulkFavorite,
    mergeTags,
    undo,
    clearUndoStack,
  };
}
