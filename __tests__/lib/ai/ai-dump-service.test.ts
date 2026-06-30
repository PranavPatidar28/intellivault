/**
 * Tests for ai-dump-service.ts
 *
 * Covers processAIDump (validation, toggle gating, Promise.allSettled fallbacks,
 * tag fallback via suggestTags), regenerateSection (each section + refine path +
 * unknown section), getDefaultTitles (indirectly), chunkContentForProcessing,
 * and the streaming pipeline processAIDumpStream (image transcription, truncation
 * warning, event ordering, fallbacks).
 */

const mockGenText = jest.fn();
const mockGenObject = jest.fn();
const mockGenFullStream = jest.fn();
const mockGenMultimodal = jest.fn();

jest.mock("@/lib/ai/generate", () => ({
  genText: (...a: unknown[]) => mockGenText(...a),
  genObject: (...a: unknown[]) => mockGenObject(...a),
  genFullStream: (...a: unknown[]) => mockGenFullStream(...a),
  genMultimodal: (...a: unknown[]) => mockGenMultimodal(...a),
  EmptyContentError: class EmptyContentError extends Error {},
}));

const mockGetModelLabel = jest.fn(() => "test:model");
const mockSupportsMultimodal = jest.fn(() => true);
jest.mock("@/lib/ai/provider", () => ({
  getModelLabel: (...a: unknown[]) => mockGetModelLabel(...a),
  supportsMultimodal: (...a: unknown[]) => mockSupportsMultimodal(...a),
}));

const mockSuggestTags = jest.fn();
jest.mock("@/lib/ai/auto-tagging-service", () => ({
  suggestTags: (...a: unknown[]) => mockSuggestTags(...a),
}));

const mockChunkText = jest.fn();
jest.mock("@/lib/ai/chunker", () => ({
  chunkText: (...a: unknown[]) => mockChunkText(...a),
}));

import {
  processAIDump,
  regenerateSection,
  chunkContentForProcessing,
  processAIDumpStream,
} from "@/lib/ai/ai-dump-service";
import type { AIDumpOptions } from "@/lib/validations/ai-dump";

const USER_ID = "test-user-id";

const baseOptions: AIDumpOptions = {
  template: "auto",
  toggles: {
    titles: true,
    tags: true,
    markdown: true,
    actions: true,
    preserveCode: true,
  },
  tone: "balanced",
  temperature: 0.2,
};

async function* asyncFrom<T>(items: T[]): AsyncGenerator<T> {
  for (const i of items) yield i;
}

const validTitleObj = {
  titles: [
    { variant: "short", text: "Short", score: 0.9 },
    { variant: "descriptive", text: "A descriptive title", score: 0.8 },
    { variant: "shareable", text: "Shareable Title", score: 0.7 },
  ],
  tags: [{ name: "topic", confidence: 0.9 }],
  tldr: "A short tldr.",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("processAIDump - validation", () => {
  it("rejects content shorter than the minimum length", async () => {
    await expect(processAIDump("hi", USER_ID, baseOptions)).rejects.toThrow(
      "Content is too short for processing"
    );
  });

  it("rejects empty/whitespace content", async () => {
    await expect(processAIDump("   ", USER_ID, baseOptions)).rejects.toThrow(
      "Content is too short for processing"
    );
  });
});

describe("processAIDump - happy path", () => {
  it("assembles titles, tags, tldr, summary, markdown, actions and provenance", async () => {
    mockGenObject
      .mockResolvedValueOnce({ object: validTitleObj, provider: "p", latencyMs: 1 }) // titleTagsTldr
      .mockResolvedValueOnce({
        object: { actions: [{ text: "do x", assignee: "", due_date: null, confidence: 0.9 }] },
        provider: "p",
        latencyMs: 1,
      }); // actions
    mockGenText
      .mockResolvedValueOnce({ text: "# Structured markdown", provider: "p", latencyMs: 1 }) // markdown
      .mockResolvedValueOnce({ text: "A full summary.", provider: "p", latencyMs: 1 }); // summary

    const result = await processAIDump(
      "This is a sufficiently long piece of content to process.",
      USER_ID,
      baseOptions
    );

    expect(result.titles).toEqual(validTitleObj.titles);
    expect(result.tags).toEqual(validTitleObj.tags);
    expect(result.tldr).toBe("A short tldr.");
    expect(result.summary).toBe("A full summary.");
    expect(result.markdown).toBe("# Structured markdown");
    expect(result.actions).toHaveLength(1);
    expect(result.provenance.llm_model).toBe("test:model");
    expect(result.provenance.temperature).toBe(0.2);
    // suggestTags fallback should not run since tags came back.
    expect(mockSuggestTags).not.toHaveBeenCalled();
  });

  it("truncates content longer than MAX_CONTENT_LENGTH", async () => {
    mockGenObject.mockResolvedValue({ object: validTitleObj, provider: "p", latencyMs: 1 });
    mockGenText.mockResolvedValue({ text: "ok", provider: "p", latencyMs: 1 });

    const long = "a".repeat(60000);
    await processAIDump(long, USER_ID, baseOptions);

    // The markdown generation prompt should include the truncation marker.
    const mdPrompt = mockGenText.mock.calls[0][0] as string;
    expect(mdPrompt).toContain("[Content truncated...]");
  });
});

describe("processAIDump - fallbacks", () => {
  it("falls back to default titles and suggestTags when title generation fails", async () => {
    // generateTitleTagsTldr internally catches and returns null, so genObject
    // rejecting here yields a null titleTagsTldr.
    mockGenObject
      .mockRejectedValueOnce(new Error("title fail")) // titleTagsTldr -> null
      .mockResolvedValueOnce({ object: { actions: [] }, provider: "p", latencyMs: 1 }); // actions
    mockGenText
      .mockResolvedValueOnce({ text: "md", provider: "p", latencyMs: 1 })
      .mockResolvedValueOnce({ text: "summary text", provider: "p", latencyMs: 1 });
    mockSuggestTags.mockResolvedValueOnce({
      suggestions: [{ name: "fallback-tag", confidence: 0.6 }],
    });

    const result = await processAIDump(
      "Long enough content for the pipeline to run.",
      USER_ID,
      baseOptions
    );

    expect(result.titles).toHaveLength(3); // default titles
    expect(result.tags).toEqual([{ name: "fallback-tag", confidence: 0.6 }]);
    expect(mockSuggestTags).toHaveBeenCalled();
    // tldr falls back to summary slice
    expect(result.tldr).toBe("summary text".slice(0, 200));
  });

  it("returns empty tags when both title gen and suggestTags fail", async () => {
    mockGenObject
      .mockRejectedValueOnce(new Error("title fail"))
      .mockResolvedValueOnce({ object: { actions: [] }, provider: "p", latencyMs: 1 });
    mockGenText
      .mockResolvedValueOnce({ text: "md", provider: "p", latencyMs: 1 })
      .mockResolvedValueOnce({ text: "summary", provider: "p", latencyMs: 1 });
    mockSuggestTags.mockRejectedValueOnce(new Error("tag fail"));

    const result = await processAIDump(
      "Long enough content for the pipeline.",
      USER_ID,
      baseOptions
    );
    expect(result.tags).toEqual([]);
  });

  it("uses 'Summary generation failed' fallback when summary throws and content as markdown", async () => {
    // titles ok, markdown disabled to test markdown fallback path separately.
    mockGenObject.mockResolvedValueOnce({
      object: validTitleObj,
      provider: "p",
      latencyMs: 1,
    });
    // markdown generation: genText first call (markdown) then summary.
    mockGenText
      .mockResolvedValueOnce({ text: "md", provider: "p", latencyMs: 1 }) // markdown
      .mockRejectedValueOnce(new Error("summary fail")); // summary -> caught, returns slice

    const opts: AIDumpOptions = {
      ...baseOptions,
      toggles: { ...baseOptions.toggles, actions: false },
    };

    const content = "Long enough content for the pipeline to run on.";
    const result = await processAIDump(content, USER_ID, opts);
    // generateSummary catches internally and returns content slice, not the
    // outer "Summary generation failed" sentinel.
    expect(result.summary.startsWith(content.slice(0, 50))).toBe(true);
  });

  it("skips disabled toggles (no markdown/actions generation)", async () => {
    mockGenObject.mockResolvedValueOnce({
      object: validTitleObj,
      provider: "p",
      latencyMs: 1,
    });
    // Only the summary genText call should happen (markdown disabled).
    mockGenText.mockResolvedValueOnce({ text: "summary", provider: "p", latencyMs: 1 });

    const opts: AIDumpOptions = {
      ...baseOptions,
      toggles: {
        titles: true,
        tags: true,
        markdown: false,
        actions: false,
        preserveCode: true,
      },
    };

    const content = "Sufficiently long content for processing here.";
    const result = await processAIDump(content, USER_ID, opts);
    // markdown falls back to processedContent
    expect(result.markdown).toBe(content);
    expect(result.actions).toEqual([]);
    expect(mockGenText).toHaveBeenCalledTimes(1); // summary only
  });
});

describe("regenerateSection", () => {
  it("titles: returns generated titles", async () => {
    mockGenObject.mockResolvedValueOnce({
      object: validTitleObj,
      provider: "p",
      latencyMs: 1,
    });
    const result = await regenerateSection("titles", "raw text", USER_ID, {});
    expect(result.titles).toEqual(validTitleObj.titles);
  });

  it("titles: falls back to default titles on failure", async () => {
    mockGenObject.mockRejectedValueOnce(new Error("fail"));
    const result = await regenerateSection("titles", "first line here\nmore", USER_ID, {});
    expect(result.titles).toHaveLength(3);
    expect(result.titles![0].variant).toBe("short");
  });

  it("tags: maps suggestTags output", async () => {
    mockSuggestTags.mockResolvedValueOnce({
      suggestions: [{ name: "t1", confidence: 0.8 }],
    });
    const result = await regenerateSection("tags", "raw", USER_ID, {});
    expect(result.tags).toEqual([{ name: "t1", confidence: 0.8 }]);
  });

  it("markdown: regenerates from scratch when no instruction", async () => {
    mockGenText.mockResolvedValueOnce({ text: "fresh md", provider: "p", latencyMs: 1 });
    const result = await regenerateSection("markdown", "raw content", USER_ID, {});
    expect(result.markdown).toBe("fresh md");
  });

  it("markdown: refines current markdown when an instruction is given", async () => {
    mockGenText.mockResolvedValueOnce({ text: "refined md", provider: "p", latencyMs: 1 });
    const result = await regenerateSection(
      "markdown",
      "raw",
      USER_ID,
      {},
      { instruction: "make it shorter", currentMarkdown: "the current doc" }
    );
    expect(result.markdown).toBe("refined md");
  });

  it("markdown: refine falls back to currentMarkdown when refine returns empty", async () => {
    mockGenText.mockResolvedValueOnce({ text: "   ", provider: "p", latencyMs: 1 });
    const result = await regenerateSection(
      "markdown",
      "raw",
      USER_ID,
      {},
      { instruction: "tighten", currentMarkdown: "ORIGINAL" }
    );
    expect(result.markdown).toBe("ORIGINAL");
  });

  it("markdown: falls back to rawText when generation returns null", async () => {
    mockGenText.mockRejectedValueOnce(new Error("md fail"));
    const result = await regenerateSection("markdown", "RAWTEXT", USER_ID, {});
    expect(result.markdown).toBe("RAWTEXT");
  });

  it("actions: returns extracted actions", async () => {
    mockGenObject.mockResolvedValueOnce({
      object: { actions: [{ text: "a", assignee: "", due_date: null, confidence: 0.5 }] },
      provider: "p",
      latencyMs: 1,
    });
    const result = await regenerateSection("actions", "raw", USER_ID, {});
    expect(result.actions).toHaveLength(1);
  });

  it("actions: returns [] when extraction throws", async () => {
    mockGenObject.mockRejectedValueOnce(new Error("fail"));
    const result = await regenerateSection("actions", "raw", USER_ID, {});
    expect(result.actions).toEqual([]);
  });

  it("throws on an unknown section", async () => {
    await expect(
      // @ts-expect-error testing the default branch
      regenerateSection("nonsense", "raw", USER_ID, {})
    ).rejects.toThrow(/Unknown section/);
  });
});

describe("chunkContentForProcessing", () => {
  it("returns a single chunk when content is short", () => {
    const result = chunkContentForProcessing("short");
    expect(result.chunks).toEqual(["short"]);
    expect(result.needsSummarization).toBe(false);
    expect(mockChunkText).not.toHaveBeenCalled();
  });

  it("chunks long content and flags summarization when multiple chunks result", () => {
    mockChunkText.mockReturnValueOnce([
      { text: "chunk1" },
      { text: "chunk2" },
    ]);
    const long = "a".repeat(5000);
    const result = chunkContentForProcessing(long);
    expect(result.chunks).toEqual(["chunk1", "chunk2"]);
    expect(result.needsSummarization).toBe(true);
  });

  it("does not flag summarization for a single returned chunk", () => {
    mockChunkText.mockReturnValueOnce([{ text: "only" }]);
    const long = "a".repeat(5000);
    const result = chunkContentForProcessing(long);
    expect(result.needsSummarization).toBe(false);
  });
});

describe("processAIDumpStream", () => {
  async function collect(gen: AsyncGenerator<{ type: string; data: unknown }>) {
    const events: { type: string; data: unknown }[] = [];
    for await (const e of gen) events.push(e);
    return events;
  }

  it("validates content length (throws on too-short input)", async () => {
    const gen = processAIDumpStream("hi", USER_ID, baseOptions);
    await expect(collect(gen)).rejects.toThrow("Content is too short for processing");
  });

  it("emits the expected ordered events on the happy path", async () => {
    mockGenObject
      .mockResolvedValueOnce({ object: validTitleObj, provider: "p", latencyMs: 1 }) // titles
      .mockResolvedValueOnce({
        object: { actions: [{ text: "act", assignee: "", due_date: null, confidence: 0.8 }] },
        provider: "p",
        latencyMs: 1,
      }); // actions
    // markdown stream then summary stream
    mockGenFullStream
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "## MD" }]))
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "Summary." }]));

    const events = await collect(
      processAIDumpStream("Long enough content to stream.", USER_ID, baseOptions)
    );
    const types = events.map((e) => e.type);

    expect(types).toContain("resolved_content");
    expect(types).toContain("titles");
    expect(types).toContain("tags");
    expect(types).toContain("tldr");
    expect(types).toContain("markdown_end");
    expect(types).toContain("summary_end");
    expect(types).toContain("actions");
    expect(types[types.length - 1]).toBe("complete");

    const mdEnd = events.find((e) => e.type === "markdown_end");
    expect(mdEnd!.data).toBe("## MD");
    const sumEnd = events.find((e) => e.type === "summary_end");
    expect(sumEnd!.data).toBe("Summary.");
  });

  it("surfaces reasoning chunks as separate events", async () => {
    mockGenObject.mockResolvedValueOnce({
      object: validTitleObj,
      provider: "p",
      latencyMs: 1,
    });
    mockGenFullStream
      .mockReturnValueOnce(
        asyncFrom([
          { kind: "reasoning", value: "thinking..." },
          { kind: "text", value: "MD body" },
        ])
      )
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "sum" }]));

    const opts: AIDumpOptions = {
      ...baseOptions,
      toggles: { ...baseOptions.toggles, actions: false },
    };
    const events = await collect(
      processAIDumpStream("Long enough content.", USER_ID, opts)
    );
    const reasoning = events.filter((e) => e.type === "reasoning");
    expect(reasoning.length).toBeGreaterThan(0);
    expect(reasoning[0].data).toBe("thinking...");
  });

  it("emits a truncation warning for over-long input", async () => {
    mockGenObject.mockResolvedValue({ object: validTitleObj, provider: "p", latencyMs: 1 });
    mockGenFullStream
      .mockReturnValue(asyncFrom([{ kind: "text", value: "x" }]));

    const opts: AIDumpOptions = {
      ...baseOptions,
      toggles: { ...baseOptions.toggles, actions: false },
    };
    const long = "a".repeat(60000);
    const events = await collect(processAIDumpStream(long, USER_ID, opts));
    expect(events.some((e) => e.type === "warning")).toBe(true);
    const resolved = events.find((e) => e.type === "resolved_content");
    expect(String(resolved!.data)).toContain("[Content truncated...]");
  });

  it("transcribes an uploaded image and merges it into content", async () => {
    mockGenMultimodal.mockResolvedValueOnce({
      text: "transcribed image text",
      provider: "p",
      latencyMs: 1,
    });
    mockGenObject.mockResolvedValueOnce({
      object: validTitleObj,
      provider: "p",
      latencyMs: 1,
    });
    mockGenFullStream
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "md" }]))
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "sum" }]));

    const opts: AIDumpOptions = {
      ...baseOptions,
      toggles: { ...baseOptions.toggles, actions: false },
    };
    const events = await collect(
      processAIDumpStream(
        "user note",
        USER_ID,
        opts,
        "data:image/png;base64,AAAA"
      )
    );
    expect(mockGenMultimodal).toHaveBeenCalled();
    const resolved = events.find((e) => e.type === "resolved_content");
    expect(String(resolved!.data)).toContain("transcribed image text");
    expect(String(resolved!.data)).toContain("Extracted from image");
    expect(events.some((e) => e.type === "status" && e.data === "Analyzing image...")).toBe(
      true
    );
  });

  it("throws when image transcription yields nothing and there is no text content", async () => {
    mockGenMultimodal.mockResolvedValueOnce({ text: "", provider: "p", latencyMs: 1 });
    const gen = processAIDumpStream("", USER_ID, baseOptions, "data:image/png;base64,AAAA");
    await expect(collect(gen)).rejects.toThrow(/Could not extract content from the image/);
  });

  it("does not transcribe when provider lacks multimodal support and uses text only", async () => {
    mockSupportsMultimodal.mockReturnValueOnce(false);
    mockGenObject.mockResolvedValueOnce({
      object: validTitleObj,
      provider: "p",
      latencyMs: 1,
    });
    mockGenFullStream
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "md" }]))
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "sum" }]));

    const opts: AIDumpOptions = {
      ...baseOptions,
      toggles: { ...baseOptions.toggles, actions: false },
    };
    const events = await collect(
      processAIDumpStream(
        "the user provided this text",
        USER_ID,
        opts,
        "data:image/png;base64,AAAA"
      )
    );
    // transcribeImage returns null (no multimodal), content stays as text.
    expect(mockGenMultimodal).not.toHaveBeenCalled();
    const resolved = events.find((e) => e.type === "resolved_content");
    expect(String(resolved!.data)).toContain("the user provided this text");
  });

  it("falls back to processedContent when markdown stream is empty", async () => {
    mockGenObject.mockResolvedValueOnce({
      object: validTitleObj,
      provider: "p",
      latencyMs: 1,
    });
    mockGenFullStream
      .mockReturnValueOnce(asyncFrom([{ kind: "reasoning", value: "only reasoning" }])) // no text
      .mockReturnValueOnce(asyncFrom([{ kind: "text", value: "sum" }]));

    const opts: AIDumpOptions = {
      ...baseOptions,
      toggles: { ...baseOptions.toggles, actions: false },
    };
    const content = "Long enough content to stream here.";
    const events = await collect(processAIDumpStream(content, USER_ID, opts));
    const mdEnd = events.find((e) => e.type === "markdown_end");
    expect(mdEnd!.data).toBe(content);
  });
});
