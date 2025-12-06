/**
 * Tests for Pinecone Utilities
 *
 * Tests the utility functions in pinecone.ts
 */

import { getUserNamespace, getChunkId, parseChunkId } from "@/lib/ai/pinecone";

describe("getUserNamespace", () => {
  it("should generate a namespace with user_ prefix", () => {
    const namespace = getUserNamespace("user123");
    expect(namespace).toBe("user_user123");
  });

  it("should handle cuid-style user IDs", () => {
    const namespace = getUserNamespace("clx1234567890abcdefghij");
    expect(namespace).toBe("user_clx1234567890abcdefghij");
  });

  it("should handle empty string", () => {
    const namespace = getUserNamespace("");
    expect(namespace).toBe("user_");
  });
});

describe("getChunkId", () => {
  it("should generate chunk ID with noteId and index", () => {
    const chunkId = getChunkId("note123", 0);
    expect(chunkId).toBe("note123_chunk_0");
  });

  it("should handle larger chunk indices", () => {
    const chunkId = getChunkId("abc", 42);
    expect(chunkId).toBe("abc_chunk_42");
  });

  it("should handle cuid-style note IDs", () => {
    const chunkId = getChunkId("clx1234567890abcdefghij", 5);
    expect(chunkId).toBe("clx1234567890abcdefghij_chunk_5");
  });
});

describe("parseChunkId", () => {
  it("should parse a valid chunk ID", () => {
    const result = parseChunkId("note123_chunk_0");
    expect(result).toEqual({ noteId: "note123", chunkIndex: 0 });
  });

  it("should parse chunk ID with large index", () => {
    const result = parseChunkId("abc_chunk_999");
    expect(result).toEqual({ noteId: "abc", chunkIndex: 999 });
  });

  it("should handle cuid-style note IDs", () => {
    const result = parseChunkId("clx1234567890abcdefghij_chunk_5");
    expect(result).toEqual({
      noteId: "clx1234567890abcdefghij",
      chunkIndex: 5,
    });
  });

  it("should return null for invalid chunk ID format", () => {
    expect(parseChunkId("invalid")).toBeNull();
    expect(parseChunkId("no_chunk_here")).toBeNull();
    expect(parseChunkId("")).toBeNull();
  });

  it("should return null for non-numeric chunk index", () => {
    expect(parseChunkId("note_chunk_abc")).toBeNull();
  });

  it("should handle edge case with underscore in noteId", () => {
    // Note IDs with underscores should still parse correctly
    const result = parseChunkId("note_with_underscore_chunk_3");
    expect(result).toEqual({
      noteId: "note_with_underscore",
      chunkIndex: 3,
    });
  });
});
