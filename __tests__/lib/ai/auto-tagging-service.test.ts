/**
 * Tests for auto-tagging-service.ts
 *
 * Covers slug generation, suggestTags (existing-tag enrichment, confidence
 * clamping, minConfidence filtering, maxSuggestions slicing, error wrapping),
 * autoTagNote (note lookup, filtering applied tags, auto-apply path), and
 * applyTagsToNote (find/create + connect + usage count).
 */

// Mock the structured-output generator.
const mockGenObject = jest.fn();
jest.mock("@/lib/ai/generate", () => ({
  genObject: (...args: unknown[]) => mockGenObject(...args),
}));

import mockPrismaClient from "../../mocks/prisma";
import {
  generateSlug,
  suggestTags,
  autoTagNote,
  applyTagsToNote,
} from "@/lib/ai/auto-tagging-service";

const USER_ID = "test-user-id";

beforeEach(() => {
  jest.clearAllMocks();
  // tag.updateMany is used by autoTagNote's auto-apply path but isn't on the
  // shared prisma mock — add it at runtime in this test file only.
  mockPrismaClient.tag.updateMany = jest.fn();
});

describe("generateSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(generateSlug("Machine Learning")).toBe("machine-learning");
  });

  it("strips special characters", () => {
    expect(generateSlug("React & Hooks!")).toBe("react-hooks");
  });

  it("collapses multiple spaces and hyphens", () => {
    expect(generateSlug("a   b---c")).toBe("a-b-c");
  });

  it("trims surrounding whitespace", () => {
    expect(generateSlug("  spaced  ")).toBe("spaced");
  });
});

describe("suggestTags", () => {
  it("returns enriched suggestions and matches existing tags case-insensitively", async () => {
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([
      {
        id: "tag-1",
        name: "React",
        slug: "react",
        color: "#61dafb",
        usageCount: 10,
      },
    ]);

    mockGenObject.mockResolvedValueOnce({
      object: {
        suggestions: [
          { name: "react", confidence: 0.9, reason: "mentions react" },
          { name: "frontend", confidence: 0.7, reason: "ui topic" },
        ],
      },
      provider: "test:model",
      latencyMs: 42,
    });

    const result = await suggestTags("some content about react", USER_ID);

    expect(result.provider).toBe("test:model");
    expect(result.latencyMs).toBe(42);
    expect(result.suggestions).toHaveLength(2);

    const reactSuggestion = result.suggestions.find((s) => s.slug === "react");
    expect(reactSuggestion).toBeDefined();
    expect(reactSuggestion!.isExisting).toBe(true);
    expect(reactSuggestion!.existingTagId).toBe("tag-1");
    expect(reactSuggestion!.name).toBe("React"); // canonical existing name
    expect(reactSuggestion!.color).toBe("#61dafb");

    const frontend = result.suggestions.find((s) => s.slug === "frontend");
    expect(frontend!.isExisting).toBe(false);
    expect(frontend!.existingTagId).toBeUndefined();
  });

  it("clamps confidence into [0,1]", async () => {
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    mockGenObject.mockResolvedValueOnce({
      object: {
        suggestions: [
          { name: "high", confidence: 1.5, reason: "r" },
          { name: "low", confidence: -0.4, reason: "r" },
        ],
      },
      provider: "p",
      latencyMs: 1,
    });

    const result = await suggestTags("content", USER_ID, { minConfidence: 0 });
    const high = result.suggestions.find((s) => s.name === "high");
    const low = result.suggestions.find((s) => s.name === "low");
    expect(high!.confidence).toBe(1);
    expect(low!.confidence).toBe(0);
  });

  it("filters out suggestions below minConfidence", async () => {
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    mockGenObject.mockResolvedValueOnce({
      object: {
        suggestions: [
          { name: "keep", confidence: 0.8, reason: "r" },
          { name: "drop", confidence: 0.1, reason: "r" },
        ],
      },
      provider: "p",
      latencyMs: 1,
    });

    const result = await suggestTags("content", USER_ID, { minConfidence: 0.3 });
    expect(result.suggestions.map((s) => s.name)).toEqual(["keep"]);
  });

  it("slices results down to maxSuggestions", async () => {
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    mockGenObject.mockResolvedValueOnce({
      object: {
        suggestions: Array.from({ length: 5 }, (_, i) => ({
          name: `t${i}`,
          confidence: 0.9,
          reason: "r",
        })),
      },
      provider: "p",
      latencyMs: 1,
    });

    const result = await suggestTags("content", USER_ID, { maxSuggestions: 2 });
    expect(result.suggestions).toHaveLength(2);
  });

  it("uses fallback reason/confidence when raw values are missing", async () => {
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    mockGenObject.mockResolvedValueOnce({
      object: {
        suggestions: [{ name: "x" }],
      },
      provider: "p",
      latencyMs: 1,
    });

    const result = await suggestTags("content", USER_ID, { minConfidence: 0 });
    expect(result.suggestions[0].confidence).toBe(0.5); // raw.confidence ?? 0.5
    expect(result.suggestions[0].reason).toBe("AI suggested");
  });

  it("wraps generation errors in a descriptive Error", async () => {
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGenObject.mockRejectedValueOnce(new Error("LLM down"));

    await expect(suggestTags("content", USER_ID)).rejects.toThrow(
      /Failed to generate tag suggestions: LLM down/
    );
    errSpy.mockRestore();
  });

  it("queries only the user's non-archived, non-deleted tags", async () => {
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    mockGenObject.mockResolvedValueOnce({
      object: { suggestions: [] },
      provider: "p",
      latencyMs: 1,
    });

    await suggestTags("content", USER_ID);
    expect(mockPrismaClient.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, deletedAt: null, isArchived: false },
      })
    );
  });
});

describe("autoTagNote", () => {
  it("throws when the note does not exist", async () => {
    mockPrismaClient.note.findUnique.mockResolvedValueOnce(null);
    await expect(autoTagNote("missing", USER_ID)).rejects.toThrow("Note not found");
  });

  it("filters out tags already on the note", async () => {
    mockPrismaClient.note.findUnique.mockResolvedValueOnce({
      id: "note-1",
      title: "Title",
      contentText: "body",
      tags: [{ id: "t-existing", name: "React" }],
    });
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    mockGenObject.mockResolvedValueOnce({
      object: {
        suggestions: [
          { name: "react", confidence: 0.9, reason: "r" }, // already applied
          { name: "typescript", confidence: 0.9, reason: "r" },
        ],
      },
      provider: "p",
      latencyMs: 1,
    });

    const result = await autoTagNote("note-1", USER_ID);
    expect(result.suggestions.map((s) => s.name)).toEqual(["typescript"]);
  });

  it("auto-applies only existing, high-confidence tags and updates usage", async () => {
    mockPrismaClient.note.findUnique.mockResolvedValueOnce({
      id: "note-1",
      title: "Title",
      contentText: "body",
      tags: [],
    });
    // Existing tags: 'react' exists, 'typescript' does not.
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([
      { id: "t-react", name: "react", slug: "react", color: null, usageCount: 1 },
    ]);
    mockGenObject.mockResolvedValueOnce({
      object: {
        suggestions: [
          { name: "react", confidence: 0.95, reason: "r" }, // existing + high -> applied
          { name: "typescript", confidence: 0.95, reason: "r" }, // new -> not applied
          { name: "react", confidence: 0.5, reason: "r" }, // low conf duplicate ignored anyway
        ],
      },
      provider: "p",
      latencyMs: 1,
    });
    mockPrismaClient.note.update.mockResolvedValueOnce({});
    mockPrismaClient.tag.updateMany.mockResolvedValueOnce({});

    const result = await autoTagNote("note-1", USER_ID, {
      autoApply: true,
      autoApplyThreshold: 0.7,
    });

    expect(mockPrismaClient.note.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "note-1" },
        data: { tags: { connect: [{ id: "t-react" }] } },
      })
    );
    expect(mockPrismaClient.tag.updateMany).toHaveBeenCalled();
    expect(result.appliedTags).toContain("react");
  });

  it("does not touch the DB when autoApply is false", async () => {
    mockPrismaClient.note.findUnique.mockResolvedValueOnce({
      id: "note-1",
      title: "Title",
      contentText: "body",
      tags: [],
    });
    mockPrismaClient.tag.findMany.mockResolvedValueOnce([]);
    mockGenObject.mockResolvedValueOnce({
      object: { suggestions: [{ name: "x", confidence: 0.95, reason: "r" }] },
      provider: "p",
      latencyMs: 1,
    });

    const result = await autoTagNote("note-1", USER_ID, { autoApply: false });
    expect(mockPrismaClient.note.update).not.toHaveBeenCalled();
    expect(result.appliedTags).toBeUndefined();
  });
});

describe("applyTagsToNote", () => {
  it("connects an existing tag without creating it", async () => {
    mockPrismaClient.tag.findFirst.mockResolvedValueOnce({
      id: "t-1",
      name: "react",
      slug: "react",
    });
    mockPrismaClient.note.update.mockResolvedValueOnce({});
    mockPrismaClient.tag.update.mockResolvedValueOnce({});

    const result = await applyTagsToNote("note-1", USER_ID, ["react"]);

    expect(mockPrismaClient.tag.create).not.toHaveBeenCalled();
    expect(result.applied).toEqual(["react"]);
    expect(result.created).toEqual([]);
    expect(mockPrismaClient.note.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tags: { connect: { id: "t-1" } } },
      })
    );
  });

  it("creates a new tag when none matches and tracks it as created", async () => {
    mockPrismaClient.tag.findFirst.mockResolvedValueOnce(null);
    mockPrismaClient.tag.create.mockResolvedValueOnce({
      id: "new-1",
      name: "newtag",
      slug: "newtag",
    });
    mockPrismaClient.note.update.mockResolvedValueOnce({});
    mockPrismaClient.tag.update.mockResolvedValueOnce({});

    const result = await applyTagsToNote("note-1", USER_ID, ["NewTag"], {
      defaultColor: "#abc",
    });

    expect(mockPrismaClient.tag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "NewTag",
          slug: "newtag",
          userId: USER_ID,
          color: "#abc",
        }),
      })
    );
    expect(result.created).toEqual(["NewTag"]);
    expect(result.applied).toEqual(["NewTag"]);
  });

  it("handles multiple tags (mix of existing and created)", async () => {
    mockPrismaClient.tag.findFirst
      .mockResolvedValueOnce({ id: "t-1", name: "a", slug: "a" })
      .mockResolvedValueOnce(null);
    mockPrismaClient.tag.create.mockResolvedValueOnce({
      id: "t-2",
      name: "b",
      slug: "b",
    });
    mockPrismaClient.note.update.mockResolvedValue({});
    mockPrismaClient.tag.update.mockResolvedValue({});

    const result = await applyTagsToNote("note-1", USER_ID, ["a", "b"]);
    expect(result.applied).toEqual(["a", "b"]);
    expect(result.created).toEqual(["b"]);
  });

  it("defaults color to null when no defaultColor is provided", async () => {
    mockPrismaClient.tag.findFirst.mockResolvedValueOnce(null);
    mockPrismaClient.tag.create.mockResolvedValueOnce({ id: "n", name: "x", slug: "x" });
    mockPrismaClient.note.update.mockResolvedValueOnce({});
    mockPrismaClient.tag.update.mockResolvedValueOnce({});

    await applyTagsToNote("note-1", USER_ID, ["x"]);
    expect(mockPrismaClient.tag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ color: null }),
      })
    );
  });
});
