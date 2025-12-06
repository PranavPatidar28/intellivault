/**
 * Tests for Pinecone Service
 *
 * Tests the CRUD operations for note embeddings.
 */

// Set up environment mock before imports
jest.mock("@/env", () => ({
  env: {
    PINECONE_API_KEY: "test-api-key",
    PINECONE_INDEX_HOST: "https://test-index.pinecone.io",
    PINECONE_INDEX_NAME: "test-index",
  },
}));

// Import mocks
import {
  mockNamespace,
  mockIndex,
  resetPineconeMocks,
} from "../../mocks/pinecone";

// Import the module under test AFTER mocks
import {
  upsertNoteChunks,
  deleteNoteVectors,
  searchNotes,
  checkPineconeHealth,
} from "@/lib/ai/pinecone-service";

describe("Pinecone Service", () => {
  beforeEach(() => {
    resetPineconeMocks();
  });

  describe("upsertNoteChunks", () => {
    it("should chunk and upsert note content", async () => {
      mockNamespace.upsertRecords.mockResolvedValueOnce(undefined);

      const result = await upsertNoteChunks(
        "note123",
        "user456",
        "Test Note",
        "This is the content of the test note. It should be chunked and embedded.",
        ["tag1", "tag2"]
      );

      expect(result.success).toBe(true);
      expect(result.noteId).toBe("note123");
      expect(result.chunkCount).toBeGreaterThanOrEqual(1);
      expect(mockIndex.namespace).toHaveBeenCalledWith("notes");
      expect(mockNamespace.upsertRecords).toHaveBeenCalled();

      // Verify the structure of upserted records
      const upsertCall = mockNamespace.upsertRecords.mock.calls[0][0];
      expect(Array.isArray(upsertCall)).toBe(true);
      expect(upsertCall[0]).toHaveProperty("_id");
      expect(upsertCall[0]).toHaveProperty("chunk_text");
      expect(upsertCall[0]).toHaveProperty("noteId", "note123");
      expect(upsertCall[0]).toHaveProperty("userId", "user456");
      expect(upsertCall[0]).toHaveProperty("title", "Test Note");
      expect(upsertCall[0]).toHaveProperty("tags", ["tag1", "tag2"]);
    });

    it("should embed title even if content is empty", async () => {
      mockNamespace.upsertRecords.mockResolvedValueOnce(undefined);

      const result = await upsertNoteChunks(
        "note123",
        "user456",
        "Empty Note",
        "",
        []
      );

      expect(result.success).toBe(true);
      expect(result.chunkCount).toBeGreaterThan(0);
      expect(mockNamespace.upsertRecords).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockNamespace.upsertRecords.mockRejectedValueOnce(
        new Error("Pinecone error")
      );

      const result = await upsertNoteChunks(
        "note123",
        "user456",
        "Test Note",
        "Some content to embed",
        []
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Pinecone error");
    });

    it("should use 'Untitled' for empty title", async () => {
      await upsertNoteChunks(
        "note123",
        "user456",
        "",
        "Some content to embed",
        []
      );

      const upsertCall = mockNamespace.upsertRecords.mock.calls[0][0];
      expect(upsertCall[0].title).toBe("Untitled");
    });
  });

  describe("deleteNoteVectors", () => {
    it("should delete vectors by IDs when chunk count is known", async () => {
      mockNamespace.deleteMany.mockResolvedValueOnce(undefined);

      const result = await deleteNoteVectors("note123", "user456", 3);

      expect(result).toBe(true);
      expect(mockIndex.namespace).toHaveBeenCalledWith("notes");
      expect(mockNamespace.deleteMany).toHaveBeenCalledWith([
        "note123_chunk_0",
        "note123_chunk_1",
        "note123_chunk_2",
      ]);
    });

    it("should delete by filter when chunk count is unknown", async () => {
      mockNamespace.deleteMany.mockResolvedValueOnce(undefined);

      const result = await deleteNoteVectors("note123", "user456");

      expect(result).toBe(true);
      expect(mockNamespace.deleteMany).toHaveBeenCalledWith({
        filter: {
          noteId: { $eq: "note123" },
          userId: { $eq: "user456" }
        },
      });
    });

    it("should handle delete errors gracefully", async () => {
      mockNamespace.deleteMany.mockRejectedValueOnce(new Error("Delete failed"));

      const result = await deleteNoteVectors("note123", "user456", 2);

      expect(result).toBe(false);
    });
  });

  describe("searchNotes", () => {
    it("should search and return results", async () => {
      mockNamespace.searchRecords.mockResolvedValueOnce({
        result: {
          hits: [
            {
              _id: "note123_chunk_0",
              _score: 0.95,
              fields: {
                noteId: "note123",
                chunkIndex: 0,
                chunk_text: "Matching content here",
                title: "Test Note",
                preview: "Matching content...",
                tags: ["tag1"],
              },
            },
            {
              _id: "note456_chunk_2",
              _score: 0.82,
              fields: {
                noteId: "note456",
                chunkIndex: 2,
                chunk_text: "Another matching chunk",
                title: "Another Note",
                preview: "Another matching...",
                tags: [],
              },
            },
          ],
        },
      });

      const results = await searchNotes("user456", "search query", 10);

      expect(results).toHaveLength(2);
      expect(results[0].noteId).toBe("note123");
      expect(results[0].score).toBe(0.95);
      expect(results[0].chunkText).toBe("Matching content here");
      expect(results[1].noteId).toBe("note456");
      expect(results[1].score).toBe(0.82);

      expect(mockNamespace.searchRecords).toHaveBeenCalledWith({
        query: {
          inputs: { text: "search query" },
          topK: 10,
          filter: { userId: { $eq: "user456" } },
        },
        fields: ["noteId", "chunkIndex", "chunk_text", "title", "preview", "tags"],
      });
    });

    it("should return empty array when no results", async () => {
      mockNamespace.searchRecords.mockResolvedValueOnce({
        result: { hits: [] },
      });

      const results = await searchNotes("user456", "no matches");

      expect(results).toEqual([]);
    });

    it("should propagate search errors", async () => {
      mockNamespace.searchRecords.mockRejectedValueOnce(
        new Error("Search failed")
      );

      await expect(searchNotes("user456", "query")).rejects.toThrow(
        "Search failed"
      );
    });
  });

  describe("checkPineconeHealth", () => {
    it("should return healthy status when accessible", async () => {
      mockIndex.describeIndexStats.mockResolvedValueOnce({
        namespaces: {},
        dimension: 1024,
      });

      const health = await checkPineconeHealth();

      expect(health.configured).toBe(true);
      expect(health.accessible).toBe(true);
      expect(health.error).toBeUndefined();
    });

    it("should return inaccessible when API fails", async () => {
      mockIndex.describeIndexStats.mockRejectedValueOnce(
        new Error("Connection failed")
      );

      const health = await checkPineconeHealth();

      expect(health.configured).toBe(true);
      expect(health.accessible).toBe(false);
      expect(health.error).toContain("Connection failed");
    });
  });
});
