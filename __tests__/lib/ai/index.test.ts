/**
 * Smoke test for the AI services barrel (index.ts).
 *
 * index.ts is pure re-export wiring with no logic of its own, so this verifies
 * the public surface is exported and callable-shaped without exercising the
 * underlying services (which have their own dedicated test files). External
 * clients in the re-exported modules are lazily constructed, so importing the
 * barrel performs no network/provider I/O.
 */

// The barrel transitively imports ESM-only SDK packages that Jest's CJS
// transform can't parse. Stub them so the module graph loads; the dedicated
// per-service tests exercise real behavior with their own targeted mocks.
jest.mock("ai", () => ({
  generateText: jest.fn(),
  streamText: jest.fn(),
  generateObject: jest.fn(),
  wrapLanguageModel: jest.fn((x) => x),
  extractReasoningMiddleware: jest.fn(),
}));
jest.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: jest.fn(() => jest.fn()),
}));
jest.mock("@ai-sdk/openai", () => ({ createOpenAI: jest.fn(() => jest.fn()) }));
jest.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: jest.fn(() => jest.fn()),
}));
jest.mock("@pinecone-database/pinecone", () => ({
  Pinecone: jest.fn(() => ({})),
}));

import * as ai from "@/lib/ai";

describe("AI services barrel exports", () => {
  const expectedFns = [
    // pinecone
    "getPinecone",
    "getNotesIndex",
    "getUserNamespace",
    "getChunkId",
    "parseChunkId",
    // chunker
    "chunkText",
    "getPreview",
    "estimateChunkCount",
    // pinecone-service
    "upsertNoteChunks",
    "deleteNoteVectors",
    "searchNotes",
    "checkPineconeHealth",
    // embedding-sync
    "embedNote",
    "processEmbeddingQueue",
    "markNoteForReembedding",
    "handleNoteDeleted",
    "getQueueStatus",
    "reembedAllNotes",
    // provider
    "getModel",
    "getMultimodalModel",
    "supportsMultimodal",
    "getModelLabel",
    "isReasoningProvider",
    // generate
    "genText",
    "genObject",
    "genTextStream",
    "genFullStream",
    "genMultimodal",
    // content-extractor
    "extractContentFromJSON",
    "validateContentForSummary",
    "prepareMultimodalContent",
    "fetchImageAsBase64",
    "needsMultimodalProcessing",
    // summarization-service
    "generateSummary",
    "generateSummaryStream",
    "generateSummaryMultimodal",
    "generateTitle",
    "generateContentHash",
    "hasContentChanged",
    // auto-tagging-service
    "suggestTags",
    "autoTagNote",
    "applyTagsToNote",
    "generateSlug",
  ] as const;

  it.each(expectedFns)("re-exports %s as a function", (name) => {
    expect(typeof (ai as Record<string, unknown>)[name]).toBe("function");
  });

  it("re-exports the EmptyContentError class", () => {
    expect(typeof ai.EmptyContentError).toBe("function");
    expect(ai.EmptyContentError.prototype).toBeInstanceOf(Error);
  });

  it("does not export anything unexpected as undefined", () => {
    for (const name of expectedFns) {
      expect((ai as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});
