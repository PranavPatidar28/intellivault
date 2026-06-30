/**
 * Tests for content-type-detection.ts
 *
 * Pure-logic heuristics: pattern + keyword scoring, weighting, confidence
 * normalization, short-circuit on tiny input, and the display map.
 */

import {
  detectContentType,
  getContentTypeDisplay,
  type ContentType,
} from "@/lib/ai/content-type-detection";

describe("detectContentType", () => {
  describe("short / empty input guard", () => {
    it("returns general for empty string", () => {
      const r = detectContentType("");
      expect(r.type).toBe("general");
      expect(r.confidence).toBe(0.5);
      expect(r.suggestedTemplate).toBe("auto");
      expect(r.reason).toBe("Content too short to analyze");
      expect(r.detectedFeatures).toEqual([]);
    });

    it("returns general for whitespace-only string", () => {
      const r = detectContentType("        \n   ");
      expect(r.type).toBe("general");
      expect(r.confidence).toBe(0.5);
    });

    it("returns general for content under 20 trimmed chars", () => {
      const r = detectContentType("too short");
      expect(r.type).toBe("general");
      expect(r.reason).toBe("Content too short to analyze");
    });

    it("treats undefined/null content as too short without throwing", () => {
      // @ts-expect-error intentional: exercise the falsy guard
      const r = detectContentType(undefined);
      expect(r.type).toBe("general");
      expect(r.confidence).toBe(0.5);
    });
  });

  describe("result shape", () => {
    it("always returns confidence within [0.3, 1.0]", () => {
      const r = detectContentType(
        "This is just some perfectly ordinary prose with nothing special about it at all."
      );
      expect(r.confidence).toBeGreaterThanOrEqual(0.3);
      expect(r.confidence).toBeLessThanOrEqual(1.0);
    });

    it("falls back to general with the no-type reason when nothing matches", () => {
      const r = detectContentType(
        "xqz wbv plll mmnnoo zzqq ffgg hhjj kkll wwvv ttyy uuii"
      );
      expect(r.type).toBe("general");
      expect(r.reason).toBe("General content - no specific type detected");
      expect(r.suggestedTemplate).toBe("auto");
      // general has empty features
      expect(r.detectedFeatures).toEqual([]);
    });
  });

  describe("type detection by content", () => {
    it("detects code content and suggests code-review template", () => {
      const content = `
        Here is the implementation. Run npm install first.
        import React from 'react';
        const handler = () => { return 42; };
        function compute(x) { return x * 2; }
        class Widget {}
        We should fix the bug in this pull request and refactor the api endpoint.
      `;
      const r = detectContentType(content);
      expect(r.type).toBe("code");
      expect(r.suggestedTemplate).toBe("code-review");
      expect(r.detectedFeatures.length).toBeGreaterThan(0);
    });

    it("detects meeting notes", () => {
      const content = `
        Attendees: John, Jane, and the whole team.
        Agenda: discuss the sprint.
        Discussed: the roadmap during our standup sync.
        Decided: ship on Friday.
        Action items: follow up with everyone.
        Next steps: schedule the retro call.
        John said we should meet at 10:30 am.
        @bob please review.
      `;
      const r = detectContentType(content);
      expect(r.type).toBe("meeting");
      expect(r.suggestedTemplate).toBe("meeting");
    });

    it("detects research content", () => {
      const content = `
        Abstract: This study shows interesting results.
        Hypothesis: the effect is real.
        Methodology: we ran a survey and analysis.
        Findings: significant data was found [1] [2].
        Smith et al. reached a similar conclusion.
        References: see the source list. Literature review included.
      `;
      const r = detectContentType(content);
      expect(r.type).toBe("research");
      expect(r.suggestedTemplate).toBe("research");
    });

    it("detects email content", () => {
      const content = `
        From: alice@example.com
        To: bob@example.com
        Subject: Quick question
        Dear Bob,
        Thanks for the reply to my email inbox message.
        Best regards,
        Alice
      `;
      const r = detectContentType(content);
      expect(r.type).toBe("email");
    });

    it("detects lecture / study content", () => {
      const content = `
        Chapter 1 lesson 2 module 3.
        Learning objectives: understand the concept.
        Key concepts: definition of the term.
        Example: an exercise for the student.
        Note: remember this for the quiz and the assignment from the professor in class.
      `;
      const r = detectContentType(content);
      expect(r.type).toBe("lecture");
      expect(r.suggestedTemplate).toBe("lecture");
    });

    it("detects brainstorm content", () => {
      const content = `
        Idea: a brand new creative concept.
        What if we explore more options and alternatives?
        Could we consider new possibilities?
        Maybe we should think about a proposal.
        - first idea
        - second idea
        Is this a good suggestion?
      `;
      const r = detectContentType(content);
      // brainstorm-heavy, but assert it is at least recognized as a real type
      expect(["brainstorm", "list"]).toContain(r.type);
    });
  });

  describe("feature reporting", () => {
    it("includes pattern-match and keyword feature strings", () => {
      const content = `
        import x from 'y';
        const a = 1;
        function f() {}
        export const b = 2;
        We need to fix this bug, refactor, and review the pull request api endpoint.
      `;
      const r = detectContentType(content);
      const joined = r.detectedFeatures.join(" ");
      expect(joined).toMatch(/pattern matches/);
      expect(joined).toMatch(/keywords found/);
    });

    it("builds reason from the top two features", () => {
      const content = `
        Attendees: team. Agenda: sync. Action items: follow up.
        Decided to ship. Next steps planned. Standup retro sprint meeting.
      `;
      const r = detectContentType(content);
      expect(r.reason.startsWith(`Detected ${r.type} content:`)).toBe(true);
    });
  });
});

describe("getContentTypeDisplay", () => {
  const allTypes: ContentType[] = [
    "code",
    "meeting",
    "research",
    "article",
    "brainstorm",
    "lecture",
    "email",
    "list",
    "general",
  ];

  it.each(allTypes)("returns icon/label/color for %s", (type) => {
    const d = getContentTypeDisplay(type);
    expect(typeof d.icon).toBe("string");
    expect(d.icon.length).toBeGreaterThan(0);
    expect(typeof d.label).toBe("string");
    expect(d.color).toMatch(/^text-/);
  });

  it("returns specific display for code", () => {
    expect(getContentTypeDisplay("code")).toEqual({
      icon: "Code",
      label: "Code/Technical",
      color: "text-orange-500",
    });
  });

  it("falls back to general display for an unknown type", () => {
    const d = getContentTypeDisplay("nonsense" as ContentType);
    expect(d).toEqual(getContentTypeDisplay("general"));
  });
});
