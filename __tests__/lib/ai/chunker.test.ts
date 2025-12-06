/**
 * Tests for Text Chunking Utility
 *
 * Tests the chunker functions for splitting text into overlapping segments.
 */

import { chunkText, getPreview, estimateChunkCount, type TextChunk } from "@/lib/ai/chunker";

describe("chunkText", () => {
  describe("basic functionality", () => {
    it("should return empty array for empty text", () => {
      expect(chunkText("")).toEqual([]);
      expect(chunkText("   ")).toEqual([]);
      expect(chunkText("\n\n")).toEqual([]);
    });

    it("should return single chunk for short text", () => {
      const text = "This is a short text.";
      const chunks = chunkText(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].text).toBe(text);
      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[0].endOffset).toBe(text.length);
    });

    it("should chunk long text into multiple segments", () => {
      const text = "A".repeat(1200);
      const chunks = chunkText(text, { chunkSize: 500, overlap: 100 });

      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should be around chunk size
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(500);
      });
    });

    it("should create overlapping chunks", () => {
      const text = "Word ".repeat(200); // 1000 chars
      const chunks = chunkText(text, { chunkSize: 300, overlap: 50 });

      expect(chunks.length).toBeGreaterThan(1);

      // Check that chunks overlap (except possibly the last)
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = chunks[i - 1].endOffset;
        const currStart = chunks[i].startOffset;
        // Current chunk should start before previous ends (overlapping)
        // or at most at the same position
        expect(currStart).toBeLessThanOrEqual(prevEnd);
      }
    });
  });

  describe("chunk properties", () => {
    it("should assign sequential indices", () => {
      const text = "Test ".repeat(200);
      const chunks = chunkText(text, { chunkSize: 100 });

      chunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
      });
    });

    it("should track character offsets", () => {
      const text = "Hello world. This is a test. Another sentence here.";
      const chunks = chunkText(text, { chunkSize: 30, overlap: 5 });

      chunks.forEach((chunk) => {
        expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
        expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
        expect(chunk.endOffset).toBeLessThanOrEqual(text.length + 5); // Allow for whitespace normalization
      });
    });
  });

  describe("custom options", () => {
    it("should respect custom chunk size", () => {
      const text = "X".repeat(1000);
      const chunks = chunkText(text, { chunkSize: 200, overlap: 0 });

      expect(chunks).toHaveLength(5);
      chunks.slice(0, -1).forEach((chunk) => {
        expect(chunk.text.length).toBe(200);
      });
    });

    it("should respect custom overlap", () => {
      const text = "Y".repeat(600);
      const chunksNoOverlap = chunkText(text, { chunkSize: 200, overlap: 0 });
      const chunksWithOverlap = chunkText(text, { chunkSize: 200, overlap: 50 });

      // More chunks when there's overlap
      expect(chunksWithOverlap.length).toBeGreaterThanOrEqual(chunksNoOverlap.length);
    });

    it("should handle minChunkSize option", () => {
      const text = "Short text that is not long enough to chunk normally";
      const chunks = chunkText(text, { chunkSize: 500, minChunkSize: 10 });

      // Should be a single chunk since text is shorter than chunk size
      expect(chunks).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("should handle text with only whitespace characters", () => {
      expect(chunkText("     ")).toEqual([]);
      expect(chunkText("\t\t\t")).toEqual([]);
      expect(chunkText("\r\n\r\n")).toEqual([]);
    });

    it("should normalize whitespace", () => {
      const text = "Hello   world.\r\n\r\nNew   paragraph.";
      const chunks = chunkText(text);

      expect(chunks[0].text).not.toContain("\r\n");
      expect(chunks[0].text).not.toContain("  "); // No double spaces
    });

    it("should handle text exactly at chunk size", () => {
      const text = "X".repeat(500);
      const chunks = chunkText(text, { chunkSize: 500 });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
    });

    it("should handle very long text", () => {
      const text = "Lorem ipsum dolor sit amet. ".repeat(1000);
      const chunks = chunkText(text);

      expect(chunks.length).toBeGreaterThan(10);
      // All chunks should have content
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });
  });

  describe("sentence boundaries", () => {
    it("should prefer splitting at sentence boundaries", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const chunks = chunkText(text, { chunkSize: 35, overlap: 5 });

      // Chunks should ideally end at sentence boundaries
      chunks.slice(0, -1).forEach((chunk) => {
        // Most chunks should end with period or be close to one
        const lastFiveChars = chunk.text.slice(-5);
        expect(lastFiveChars).toMatch(/[.!?\s]/);
      });
    });
  });
});

describe("getPreview", () => {
  it("should return full text if shorter than maxLength", () => {
    const text = "Short text";
    expect(getPreview(text, 100)).toBe(text);
  });

  it("should truncate at word boundary with ellipsis", () => {
    const text = "This is a longer text that needs to be truncated at a word boundary";
    const preview = getPreview(text, 30);

    expect(preview.length).toBeLessThanOrEqual(33); // 30 + "..."
    expect(preview).toMatch(/\.\.\.$/);
  });

  it("should handle text with no spaces gracefully", () => {
    const text = "X".repeat(200);
    const preview = getPreview(text, 50);

    expect(preview).toBe("X".repeat(50) + "...");
  });

  it("should use default maxLength of 100", () => {
    const longText = "Word ".repeat(50);
    const preview = getPreview(longText);

    expect(preview.length).toBeLessThanOrEqual(103);
  });
});

describe("estimateChunkCount", () => {
  it("should return 1 for text shorter than chunk size", () => {
    expect(estimateChunkCount(100, { chunkSize: 500 })).toBe(1);
    expect(estimateChunkCount(500, { chunkSize: 500 })).toBe(1);
  });

  it("should calculate correct count for longer text", () => {
    // 1000 chars with 500 chunk size and 100 overlap
    // Step = 500 - 100 = 400
    // Chunks = ceil((1000 - 100) / 400) = ceil(900/400) = 3
    const count = estimateChunkCount(1000, { chunkSize: 500, overlap: 100 });
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(4);
  });

  it("should use default options", () => {
    const count = estimateChunkCount(2000);
    expect(count).toBeGreaterThan(1);
  });

  it("should handle edge case of zero length", () => {
    expect(estimateChunkCount(0)).toBe(1);
  });
});
