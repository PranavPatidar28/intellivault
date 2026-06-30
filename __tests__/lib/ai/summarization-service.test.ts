/**
 * Tests for summarization-service.ts
 *
 * Covers content hashing/change detection, generateSummary (plain + structured
 * branches, truncation, error wrapping), streaming generators (delegation),
 * generateSummaryMultimodal (image-aware confidence, error wrapping),
 * generateTitle (quote stripping), and the confidence heuristic via its
 * observable effects.
 */

const mockGenText = jest.fn();
const mockGenObject = jest.fn();
const mockGenTextStream = jest.fn();
const mockGenFullStream = jest.fn();
const mockGenMultimodal = jest.fn();

jest.mock("@/lib/ai/generate", () => ({
  genText: (...a: unknown[]) => mockGenText(...a),
  genObject: (...a: unknown[]) => mockGenObject(...a),
  genTextStream: (...a: unknown[]) => mockGenTextStream(...a),
  genFullStream: (...a: unknown[]) => mockGenFullStream(...a),
  genMultimodal: (...a: unknown[]) => mockGenMultimodal(...a),
}));

import {
  generateContentHash,
  hasContentChanged,
  generateSummary,
  generateSummaryStream,
  generateSummaryStreamParts,
  generateSummaryMultimodal,
  generateTitle,
} from "@/lib/ai/summarization-service";
import type { MultimodalPart } from "@/lib/ai/generate";

async function* asyncFrom<T>(items: T[]): AsyncGenerator<T> {
  for (const i of items) yield i;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateContentHash / hasContentChanged", () => {
  it("produces a stable 16-char hex hash", () => {
    const h = generateContentHash("hello world");
    expect(h).toHaveLength(16);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(generateContentHash("hello world")).toBe(h); // deterministic
  });

  it("differs for different content", () => {
    expect(generateContentHash("a")).not.toBe(generateContentHash("b"));
  });

  it("reports change when no stored hash exists", () => {
    expect(hasContentChanged("abc", null)).toBe(true);
    expect(hasContentChanged("abc", undefined)).toBe(true);
  });

  it("reports change only when hashes differ", () => {
    expect(hasContentChanged("abc", "abc")).toBe(false);
    expect(hasContentChanged("abc", "xyz")).toBe(true);
  });
});

describe("generateSummary - plain branch", () => {
  it("returns a trimmed summary with provider/latency", async () => {
    mockGenText.mockResolvedValueOnce({
      text: "  A concise summary.  ",
      provider: "test:model",
      latencyMs: 12,
    });

    const result = await generateSummary("some long content here for summarizing");
    expect(mockGenText).toHaveBeenCalled();
    expect(mockGenObject).not.toHaveBeenCalled();
    expect(result.summary).toBe("A concise summary.");
    expect(result.provider).toBe("test:model");
    expect(result.latencyMs).toBe(12);
    expect(result.contentHash).toHaveLength(16);
    expect(result.generatedTitle).toBeUndefined();
    expect(result.keywords).toBeUndefined();
  });

  it("truncates very long content before summarizing", async () => {
    mockGenText.mockResolvedValueOnce({ text: "sum", provider: "p", latencyMs: 1 });
    const long = "x".repeat(9000);
    await generateSummary(long);
    const promptArg = mockGenText.mock.calls[0][0] as string;
    expect(promptArg).toContain("...");
    // The truncated content should not contain the full 9000-char run.
    expect(promptArg.length).toBeLessThan(9000 + 1000);
  });

  it("wraps errors thrown by genText", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGenText.mockRejectedValueOnce(new Error("boom"));
    await expect(generateSummary("content here long enough")).rejects.toThrow(
      /Failed to generate summary: boom/
    );
    errSpy.mockRestore();
  });
});

describe("generateSummary - structured branch", () => {
  it("requests title + keywords via genObject when asked", async () => {
    mockGenObject.mockResolvedValueOnce({
      object: {
        summary: "Structured summary",
        title: "A Title",
        keywords: ["k1", "k2"],
      },
      provider: "test:model",
      latencyMs: 7,
    });

    const result = await generateSummary("content to summarize", {
      generateTitle: true,
      includeKeywords: true,
    });

    expect(mockGenObject).toHaveBeenCalled();
    expect(mockGenText).not.toHaveBeenCalled();
    expect(result.summary).toBe("Structured summary");
    expect(result.generatedTitle).toBe("A Title");
    expect(result.keywords).toEqual(["k1", "k2"]);
  });

  it("omits title/keywords from the result when not requested even in structured mode", async () => {
    // generateTitle true triggers structured branch; keywords not requested.
    mockGenObject.mockResolvedValueOnce({
      object: { summary: "s", title: "t", keywords: ["should-not-appear"] },
      provider: "p",
      latencyMs: 1,
    });
    const result = await generateSummary("content", { generateTitle: true });
    expect(result.generatedTitle).toBe("t");
    expect(result.keywords).toBeUndefined();
  });

  it("wraps errors from the structured branch", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGenObject.mockRejectedValueOnce(new Error("schema fail"));
    await expect(
      generateSummary("content", { includeKeywords: true })
    ).rejects.toThrow(/Failed to generate summary: schema fail/);
    errSpy.mockRestore();
  });
});

describe("generateSummaryStream / generateSummaryStreamParts", () => {
  it("delegates streaming text to genTextStream", async () => {
    mockGenTextStream.mockReturnValueOnce(asyncFrom(["chunk1", "chunk2"]));
    const out: string[] = [];
    for await (const c of generateSummaryStream("content")) out.push(c);
    expect(out).toEqual(["chunk1", "chunk2"]);
    expect(mockGenTextStream).toHaveBeenCalled();
  });

  it("delegates reasoning-aware streaming to genFullStream", async () => {
    const parts = [
      { kind: "reasoning", value: "think" },
      { kind: "text", value: "answer" },
    ];
    mockGenFullStream.mockReturnValueOnce(asyncFrom(parts));
    const out: unknown[] = [];
    for await (const p of generateSummaryStreamParts("content")) out.push(p);
    expect(out).toEqual(parts);
    expect(mockGenFullStream).toHaveBeenCalled();
  });
});

describe("generateSummaryMultimodal", () => {
  it("summarizes text-only parts at full confidence weighting", async () => {
    mockGenMultimodal.mockResolvedValueOnce({
      text: "  multimodal summary  ",
      provider: "test:model",
      latencyMs: 9,
    });

    const parts: MultimodalPart[] = [{ type: "text", text: "hello there" }];
    const result = await generateSummaryMultimodal(parts);
    expect(result.summary).toBe("multimodal summary");
    expect(result.provider).toBe("test:model");
    expect(result.contentHash).toHaveLength(16);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("applies a 0.9 image penalty to confidence when images are present", async () => {
    const longText = "word ".repeat(40).trim(); // give a reasonable compression ratio
    mockGenMultimodal.mockResolvedValue({
      text: "a fairly detailed summary of the content here",
      provider: "p",
      latencyMs: 1,
    });

    const textOnly: MultimodalPart[] = [{ type: "text", text: longText }];
    const withImage: MultimodalPart[] = [
      { type: "text", text: longText },
      { type: "image", base64Data: "AAAA", mimeType: "image/png" },
    ];

    const r1 = await generateSummaryMultimodal(textOnly);
    const r2 = await generateSummaryMultimodal(withImage);

    // Same text/summary, but image version is scaled by 0.9.
    expect(r2.confidence).toBeCloseTo(r1.confidence * 0.9, 5);
  });

  it("wraps errors from genMultimodal", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGenMultimodal.mockRejectedValueOnce(new Error("vision down"));
    await expect(
      generateSummaryMultimodal([{ type: "text", text: "x" }])
    ).rejects.toThrow(/Failed to generate multimodal summary: vision down/);
    errSpy.mockRestore();
  });
});

describe("generateTitle", () => {
  it("strips surrounding quotes and trims", async () => {
    mockGenText.mockResolvedValueOnce({
      text: '  "My Generated Title"  ',
      provider: "test:model",
    });
    const result = await generateTitle("some content");
    expect(result.title).toBe("My Generated Title");
    expect(result.provider).toBe("test:model");
  });

  it("handles single quotes", async () => {
    mockGenText.mockResolvedValueOnce({ text: "'Quoted'", provider: "p" });
    const result = await generateTitle("content");
    expect(result.title).toBe("Quoted");
  });

  it("leaves unquoted titles unchanged", async () => {
    mockGenText.mockResolvedValueOnce({ text: "Plain Title", provider: "p" });
    const result = await generateTitle("content");
    expect(result.title).toBe("Plain Title");
  });
});

describe("confidence heuristic (observed via generateSummary)", () => {
  it("gives low confidence for an empty/very short summary", async () => {
    mockGenText.mockResolvedValueOnce({ text: "hi", provider: "p", latencyMs: 1 });
    const result = await generateSummary("a".repeat(500));
    expect(result.confidence).toBe(0.1); // summary length < 10
  });

  it("flags too-long summaries (compression > 0.5) as 0.5 confidence", async () => {
    const content = "short original text";
    mockGenText.mockResolvedValueOnce({
      text: "this summary is clearly much longer than the short original text input given",
      provider: "p",
      latencyMs: 1,
    });
    const result = await generateSummary(content);
    expect(result.confidence).toBe(0.5);
  });

  it("returns high confidence for a well-compressed, distinct summary", async () => {
    const content = "lorem ipsum ".repeat(100); // long original
    mockGenText.mockResolvedValueOnce({
      text: "A distinct concise overview of the document content.",
      provider: "p",
      latencyMs: 1,
    });
    const result = await generateSummary(content);
    expect(result.confidence).toBe(0.8);
  });
});
