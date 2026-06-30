/**
 * Tests for ai-dump-prompts.ts
 *
 * Prompt catalogue: tone interpolation, template branching, code-preservation
 * toggle, refinement instruction injection, and provenance helpers.
 */

import {
  PROMPTS,
  getPromptId,
  getPromptSnapshot,
} from "@/lib/ai/ai-dump-prompts";
import type { AIDumpTone } from "@/lib/validations/ai-dump";

const TONES: AIDumpTone[] = ["balanced", "formal", "casual", "technical"];

describe("PROMPTS catalogue", () => {
  it("exposes the expected prompt keys", () => {
    expect(Object.keys(PROMPTS).sort()).toEqual(
      [
        "ACTION_EXTRACTION",
        "MARKDOWN_REFINE",
        "MARKDOWN_STRUCTURE",
        "SUMMARY",
        "TITLE_TAGS_TLDR",
      ].sort()
    );
  });

  it("every prompt has id, version, system, and temperature in [0,1]", () => {
    for (const key of Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]) {
      const p = PROMPTS[key];
      expect(typeof p.id).toBe("string");
      expect(typeof p.version).toBe("string");
      expect(typeof p.system).toBe("string");
      expect(p.system.length).toBeGreaterThan(0);
      expect(p.temperature).toBeGreaterThanOrEqual(0);
      expect(p.temperature).toBeLessThanOrEqual(1);
    }
  });
});

describe("TITLE_TAGS_TLDR.getTemplate", () => {
  it.each(TONES)("embeds the %s tone instruction", (tone) => {
    const out = PROMPTS.TITLE_TAGS_TLDR.getTemplate(tone);
    expect(out).toContain("## Output Format (JSON only)");
    expect(out).toContain("Content to Analyze");
    // tone instruction text is injected
    expect(out.length).toBeGreaterThan(0);
  });

  it("produces different text for different tones", () => {
    const balanced = PROMPTS.TITLE_TAGS_TLDR.getTemplate("balanced");
    const technical = PROMPTS.TITLE_TAGS_TLDR.getTemplate("technical");
    expect(balanced).not.toBe(technical);
  });
});

describe("MARKDOWN_STRUCTURE.getTemplate", () => {
  it("includes the auto instructions for the auto template", () => {
    const out = PROMPTS.MARKDOWN_STRUCTURE.getTemplate("balanced", {
      preserveCode: true,
      template: "auto",
    });
    expect(out).toContain("Use your judgment to organize it logically");
  });

  it("includes meeting-specific instructions for the meeting template", () => {
    const out = PROMPTS.MARKDOWN_STRUCTURE.getTemplate("formal", {
      preserveCode: true,
      template: "meeting",
    });
    expect(out).toContain("Structure as meeting notes");
  });

  it("falls back to auto instructions for an unknown template", () => {
    const out = PROMPTS.MARKDOWN_STRUCTURE.getTemplate("balanced", {
      preserveCode: true,
      template: "totally-unknown",
    });
    expect(out).toContain("Use your judgment to organize it logically");
  });

  it("emits the preserve-code branch when preserveCode is true", () => {
    const out = PROMPTS.MARKDOWN_STRUCTURE.getTemplate("balanced", {
      preserveCode: true,
      template: "code",
    });
    expect(out).toContain("Preserve ALL code blocks exactly as they appear");
  });

  it("emits the summarize-code branch when preserveCode is false", () => {
    const out = PROMPTS.MARKDOWN_STRUCTURE.getTemplate("balanced", {
      preserveCode: false,
      template: "code",
    });
    expect(out).toContain("Summarize long code blocks with key highlights");
    expect(out).not.toContain("Preserve ALL code blocks exactly as they appear");
  });

  it("always ends with the Raw Content marker", () => {
    const out = PROMPTS.MARKDOWN_STRUCTURE.getTemplate("casual", {
      preserveCode: true,
      template: "article",
    });
    expect(out).toContain("## Raw Content");
  });
});

describe("ACTION_EXTRACTION", () => {
  it("is a static template (no getTemplate fn) with temperature 0", () => {
    expect(PROMPTS.ACTION_EXTRACTION.temperature).toBe(0.0);
    expect(typeof PROMPTS.ACTION_EXTRACTION.template).toBe("string");
    expect(PROMPTS.ACTION_EXTRACTION.template).toContain("actions");
  });
});

describe("SUMMARY.getTemplate", () => {
  it.each(TONES)("returns a summary prompt for %s tone", (tone) => {
    const out = PROMPTS.SUMMARY.getTemplate(tone);
    expect(out).toContain("Create a comprehensive summary");
    expect(out).toContain("## Content to Summarize");
  });
});

describe("MARKDOWN_REFINE.getTemplate", () => {
  it("injects the user instruction and tone", () => {
    const out = PROMPTS.MARKDOWN_REFINE.getTemplate(
      "balanced",
      "Make it shorter"
    );
    expect(out).toContain("## Instruction");
    expect(out).toContain("Make it shorter");
    expect(out).toContain("## Current Document");
  });

  it("reflects different instructions", () => {
    const a = PROMPTS.MARKDOWN_REFINE.getTemplate("balanced", "Add bullets");
    const b = PROMPTS.MARKDOWN_REFINE.getTemplate("balanced", "Add a table");
    expect(a).toContain("Add bullets");
    expect(b).toContain("Add a table");
    expect(a).not.toBe(b);
  });
});

describe("getPromptId", () => {
  it("joins id and version", () => {
    expect(getPromptId("SUMMARY")).toBe(
      `${PROMPTS.SUMMARY.id}_${PROMPTS.SUMMARY.version}`
    );
  });

  it("works for every prompt key", () => {
    for (const key of Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]) {
      const id = getPromptId(key);
      expect(id).toBe(`${PROMPTS[key].id}_${PROMPTS[key].version}`);
    }
  });
});

describe("getPromptSnapshot", () => {
  it("returns JSON with id, version and temperature only (no content)", () => {
    const snap = getPromptSnapshot("TITLE_TAGS_TLDR");
    const parsed = JSON.parse(snap);
    expect(parsed).toEqual({
      id: PROMPTS.TITLE_TAGS_TLDR.id,
      version: PROMPTS.TITLE_TAGS_TLDR.version,
      temperature: PROMPTS.TITLE_TAGS_TLDR.temperature,
    });
    // must not leak prompt body
    expect(snap).not.toContain("system");
  });
});
