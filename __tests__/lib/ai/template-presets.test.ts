/**
 * Tests for template-presets.ts
 *
 * Static preset catalogue plus the two lookup/context helpers.
 */

import {
  TEMPLATE_PRESETS,
  getTemplateById,
  getTemplateContext,
  type TemplatePreset,
} from "@/lib/ai/template-presets";

describe("TEMPLATE_PRESETS catalogue", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(TEMPLATE_PRESETS)).toBe(true);
    expect(TEMPLATE_PRESETS.length).toBeGreaterThan(0);
  });

  it("includes the auto preset with empty context and tags", () => {
    const auto = TEMPLATE_PRESETS.find((t) => t.id === "auto");
    expect(auto).toBeDefined();
    expect(auto!.promptContext).toBe("");
    expect(auto!.suggestedTags).toEqual([]);
    expect(auto!.suggestedSections).toEqual([]);
  });

  it("has unique ids", () => {
    const ids = TEMPLATE_PRESETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every preset has the required shape", () => {
    for (const preset of TEMPLATE_PRESETS) {
      const p: TemplatePreset = preset;
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe("string");
      expect(typeof p.description).toBe("string");
      expect(typeof p.icon).toBe("string");
      expect(typeof p.example).toBe("string");
      expect(typeof p.promptContext).toBe("string");
      expect(Array.isArray(p.suggestedTags)).toBe(true);
      expect(Array.isArray(p.suggestedSections)).toBe(true);
    }
  });

  it("non-auto presets carry a non-empty promptContext", () => {
    for (const preset of TEMPLATE_PRESETS) {
      if (preset.id === "auto") continue;
      expect(preset.promptContext.length).toBeGreaterThan(0);
    }
  });
});

describe("getTemplateById", () => {
  it("returns the matching preset", () => {
    const meeting = getTemplateById("meeting");
    expect(meeting).toBeDefined();
    expect(meeting!.id).toBe("meeting");
    expect(meeting!.name).toBe("Meeting Notes");
  });

  it("returns undefined for an unknown id", () => {
    expect(getTemplateById("does-not-exist")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(getTemplateById("")).toBeUndefined();
  });
});

describe("getTemplateContext", () => {
  it("returns empty string for the auto template", () => {
    expect(getTemplateContext("auto")).toBe("");
  });

  it("returns empty string for an unknown template id", () => {
    expect(getTemplateContext("nope")).toBe("");
  });

  it("wraps a real template's promptContext with the header", () => {
    const ctx = getTemplateContext("research");
    expect(ctx.startsWith("\n\n[CONTENT TYPE CONTEXT]\n")).toBe(true);
    const research = getTemplateById("research")!;
    expect(ctx).toContain(research.promptContext);
  });

  it("returns empty string for empty input", () => {
    expect(getTemplateContext("")).toBe("");
  });
});
