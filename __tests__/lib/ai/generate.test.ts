/**
 * Tests for the LLM generation primitives (generate.ts).
 *
 * Focus: the empty-content guard that prevents a reasoning model's empty
 * answer from being silently used as content.
 */

// Mock the AI SDK so no network call happens.
const mockGenerateText = jest.fn();
jest.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  streamText: jest.fn(),
  generateObject: jest.fn(),
  wrapLanguageModel: jest.fn(),
  extractReasoningMiddleware: jest.fn(),
}));

// Mock the provider registry so getModel/getModelLabel don't build real models.
jest.mock("@/lib/ai/provider", () => ({
  getModel: jest.fn(() => ({ mock: "model" })),
  getMultimodalModel: jest.fn(() => ({ mock: "model" })),
  getModelLabel: jest.fn(() => "test:model"),
}));

import { genText, EmptyContentError } from "@/lib/ai/generate";

describe("genText empty-content guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws EmptyContentError when text is empty but reasoning is present", async () => {
    mockGenerateText.mockResolvedValue({
      text: "",
      reasoningText: "I am thinking about the answer...",
      usage: { inputTokens: 10, outputTokens: 50 },
    });

    await expect(genText("hello")).rejects.toThrow(EmptyContentError);
  });

  it("returns text normally when content is present", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Here is the answer.",
      reasoningText: "some reasoning",
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const result = await genText("hello");
    expect(result.text).toBe("Here is the answer.");
    expect(result.reasoning).toBe("some reasoning");
    expect(result.provider).toBe("test:model");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("does not throw on empty text when there is no reasoning", async () => {
    mockGenerateText.mockResolvedValue({
      text: "",
      reasoningText: undefined,
      usage: { inputTokens: 10, outputTokens: 0 },
    });

    const result = await genText("hello");
    expect(result.text).toBe("");
    expect(result.reasoning).toBeUndefined();
  });
});
