/**
 * Tests for content-extractor.ts
 *
 * Covers TipTap JSON traversal/extraction, content validation branches,
 * base64 image fetching (via safeFetchImage), multimodal part preparation,
 * and the multimodal-needed predicate.
 */

import type { JSONContent } from "@tiptap/core";

// Mock the SSRF-safe fetch so no real network/DNS happens.
const mockSafeFetchImage = jest.fn();
jest.mock("@/lib/ai/safe-fetch", () => ({
  safeFetchImage: (...args: unknown[]) => mockSafeFetchImage(...args),
}));

import {
  extractContentFromJSON,
  validateContentForSummary,
  fetchImageAsBase64,
  prepareMultimodalContent,
  needsMultimodalProcessing,
  type ExtractedContent,
} from "@/lib/ai/content-extractor";

// Helper to build a baseline ExtractedContent and override fields.
function makeExtracted(overrides: Partial<ExtractedContent> = {}): ExtractedContent {
  return {
    text: "",
    images: [],
    videos: [],
    audio: [],
    hasMedia: false,
    wordCount: 0,
    mediaCount: 0,
    ...overrides,
  };
}

describe("extractContentFromJSON", () => {
  it("extracts plain text from paragraphs and headings", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "heading", content: [{ type: "text", text: "My Heading" }] },
        { type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
      ],
    };

    const result = extractContentFromJSON(doc);
    expect(result.text).toContain("My Heading");
    expect(result.text).toContain("Hello world");
    expect(result.wordCount).toBe(4); // My, Heading, Hello, world
    expect(result.hasMedia).toBe(false);
    expect(result.mediaCount).toBe(0);
  });

  it("extracts images (both image and customImage node types)", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "https://x.test/a.png", alt: "alt-a", title: "title-a" },
        },
        {
          type: "customImage",
          attrs: { src: "https://x.test/b.png" },
        },
      ],
    };

    const result = extractContentFromJSON(doc);
    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toEqual({
      url: "https://x.test/a.png",
      alt: "alt-a",
      title: "title-a",
    });
    expect(result.images[1].url).toBe("https://x.test/b.png");
    expect(result.hasMedia).toBe(true);
    expect(result.mediaCount).toBe(2);
  });

  it("skips image nodes that have no src", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [{ type: "image", attrs: { alt: "no-src" } }],
    };
    const result = extractContentFromJSON(doc);
    expect(result.images).toHaveLength(0);
  });

  it("extracts videos and audio", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "video", attrs: { src: "https://x.test/v.mp4", title: "vid" } },
        { type: "audio", attrs: { src: "https://x.test/a.mp3" } },
      ],
    };

    const result = extractContentFromJSON(doc);
    expect(result.videos).toEqual([{ url: "https://x.test/v.mp4", title: "vid" }]);
    expect(result.audio).toEqual([{ url: "https://x.test/a.mp3", title: undefined }]);
    expect(result.mediaCount).toBe(2);
    expect(result.hasMedia).toBe(true);
  });

  it("handles nested lists and task items", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "text", text: "Item one" }] },
            { type: "taskItem", content: [{ type: "text", text: "Task two" }] },
          ],
        },
      ],
    };

    const result = extractContentFromJSON(doc);
    expect(result.text).toContain("Item one");
    expect(result.text).toContain("Task two");
  });

  it("collapses multiple newlines and trims", () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A" }] },
        { type: "paragraph", content: [] },
        { type: "paragraph", content: [] },
        { type: "paragraph", content: [{ type: "text", text: "B" }] },
      ],
    };
    const result = extractContentFromJSON(doc);
    // No run of 3+ newlines should remain.
    expect(result.text).not.toMatch(/\n{3,}/);
    expect(result.text.startsWith("A")).toBe(true);
    expect(result.text.endsWith("B")).toBe(true);
  });

  it("returns an empty result for an empty doc", () => {
    const result = extractContentFromJSON({ type: "doc", content: [] });
    expect(result.text).toBe("");
    expect(result.wordCount).toBe(0);
    expect(result.hasMedia).toBe(false);
  });

  it("does not crash on a null-ish top node", () => {
    // @ts-expect-error intentionally passing an undefined-like node
    const result = extractContentFromJSON(undefined);
    expect(result.text).toBe("");
  });
});

describe("validateContentForSummary", () => {
  it("Case 1: sufficient text can be summarized", () => {
    const extracted = makeExtracted({ text: "x".repeat(60) });
    const v = validateContentForSummary(extracted);
    expect(v.canSummarize).toBe(true);
    expect(v.suggestMultimodal).toBe(false);
  });

  it("Case 2: only images, includeImages off -> cannot, suggests multimodal", () => {
    const extracted = makeExtracted({
      text: "tiny",
      images: [{ url: "https://x.test/a.png" }],
      hasMedia: true,
      mediaCount: 1,
    });
    const v = validateContentForSummary(extracted, { includeImages: false });
    expect(v.canSummarize).toBe(false);
    expect(v.suggestMultimodal).toBe(true);
    expect(v.suggestion).toMatch(/Include images/i);
  });

  it("Case 3: images with includeImages on -> can summarize", () => {
    const extracted = makeExtracted({
      text: "tiny",
      images: [{ url: "https://x.test/a.png" }],
      hasMedia: true,
      mediaCount: 1,
    });
    const v = validateContentForSummary(extracted, { includeImages: true });
    expect(v.canSummarize).toBe(true);
    expect(v.suggestMultimodal).toBe(true);
  });

  it("Case 4: completely empty note", () => {
    const extracted = makeExtracted({ text: "" });
    const v = validateContentForSummary(extracted);
    expect(v.canSummarize).toBe(false);
    expect(v.message).toMatch(/empty/i);
  });

  it("Case 5: only video/audio is unsupported", () => {
    const extracted = makeExtracted({
      text: "tiny",
      videos: [{ url: "https://x.test/v.mp4" }],
      hasMedia: true,
      mediaCount: 1,
    });
    const v = validateContentForSummary(extracted);
    expect(v.canSummarize).toBe(false);
    expect(v.message).toMatch(/Video and audio/i);
  });

  it("Case 6: very short text fallback", () => {
    // Has some text and media-flagged via audio length 0, but text under min and
    // no images/videos/audio: must fall through to the final case.
    const extracted = makeExtracted({ text: "short", hasMedia: true, mediaCount: 0 });
    const v = validateContentForSummary(extracted);
    expect(v.canSummarize).toBe(false);
    expect(v.suggestion).toMatch(/characters of text/i);
  });
});

describe("fetchImageAsBase64", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns base64 + mimeType on success", async () => {
    mockSafeFetchImage.mockResolvedValueOnce({
      buffer: Buffer.from("hello"),
      mimeType: "image/png",
    });

    const result = await fetchImageAsBase64("https://x.test/a.png");
    expect(result).toEqual({
      base64: Buffer.from("hello").toString("base64"),
      mimeType: "image/png",
    });
  });

  it("returns null and warns when the fetch is rejected/unsafe", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockSafeFetchImage.mockRejectedValueOnce(new Error("Blocked address"));

    const result = await fetchImageAsBase64("http://169.254.169.254/");
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handles a non-Error rejection gracefully", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockSafeFetchImage.mockRejectedValueOnce("string failure");
    const result = await fetchImageAsBase64("https://x.test/a.png");
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("prepareMultimodalContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("includes title + text by default and no images", async () => {
    const extracted = makeExtracted({ text: "Body text here" });
    const parts = await prepareMultimodalContent(extracted, "My Title");
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("text");
    expect(parts[0].text).toContain("Title: My Title");
    expect(parts[0].text).toContain("Body text here");
    expect(mockSafeFetchImage).not.toHaveBeenCalled();
  });

  it("omits the title when includeTitle is false", async () => {
    const extracted = makeExtracted({ text: "Body" });
    const parts = await prepareMultimodalContent(extracted, "Title", {
      includeTitle: false,
    });
    expect(parts[0].text).not.toContain("Title:");
    expect(parts[0].text).toBe("Body");
  });

  it("produces no text part when text content is empty", async () => {
    const extracted = makeExtracted({ text: "" });
    const parts = await prepareMultimodalContent(extracted, "", {
      includeTitle: false,
    });
    expect(parts).toHaveLength(0);
  });

  it("includes images up to maxImages and skips failed fetches", async () => {
    const extracted = makeExtracted({
      text: "Body",
      images: [
        { url: "https://x.test/1.png" },
        { url: "https://x.test/2.png" },
        { url: "https://x.test/3.png" },
      ],
    });

    mockSafeFetchImage
      .mockResolvedValueOnce({ buffer: Buffer.from("a"), mimeType: "image/png" })
      .mockRejectedValueOnce(new Error("bad")); // 2nd fails -> skipped

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const parts = await prepareMultimodalContent(extracted, "T", {
      includeImages: true,
      maxImages: 2,
    });
    warnSpy.mockRestore();

    // 1 text + 1 successful image (2nd failed, 3rd not processed due to maxImages)
    expect(mockSafeFetchImage).toHaveBeenCalledTimes(2);
    const imageParts = parts.filter((p) => p.type === "image");
    expect(imageParts).toHaveLength(1);
    expect(imageParts[0].base64Data).toBe(Buffer.from("a").toString("base64"));
    expect(imageParts[0].mimeType).toBe("image/png");
  });

  it("does not fetch images when includeImages is false", async () => {
    const extracted = makeExtracted({
      text: "Body",
      images: [{ url: "https://x.test/1.png" }],
    });
    await prepareMultimodalContent(extracted, "T", { includeImages: false });
    expect(mockSafeFetchImage).not.toHaveBeenCalled();
  });

  it("skips text when includeText is false", async () => {
    const extracted = makeExtracted({ text: "Body" });
    const parts = await prepareMultimodalContent(extracted, "T", {
      includeText: false,
    });
    expect(parts).toHaveLength(0);
  });
});

describe("needsMultimodalProcessing", () => {
  it("true only when includeImages and images exist", () => {
    const withImg = makeExtracted({ images: [{ url: "https://x.test/a.png" }] });
    expect(needsMultimodalProcessing(withImg, { includeImages: true })).toBe(true);
    expect(needsMultimodalProcessing(withImg, { includeImages: false })).toBe(false);
    expect(needsMultimodalProcessing(makeExtracted(), { includeImages: true })).toBe(
      false
    );
  });

  it("defaults includeImages to false", () => {
    const withImg = makeExtracted({ images: [{ url: "https://x.test/a.png" }] });
    expect(needsMultimodalProcessing(withImg, {})).toBe(false);
  });
});
