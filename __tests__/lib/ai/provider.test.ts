/**
 * Tests for provider.ts (LLM model registry).
 *
 * The AI SDK provider packages and `ai` are mocked so no real model/network is
 * constructed. We assert provider resolution, per-provider build wiring,
 * reasoning-middleware wrapping, multimodal selection, caching, labels, and the
 * reasoning-provider predicate.
 */

// --- Mocks for the AI SDK surface ----------------------------------------

const mockGoogleClient = jest.fn((modelId: string) => ({
  __kind: "google",
  modelId,
}));
const mockCreateGoogle = jest.fn(() => mockGoogleClient);

const mockOpenAIClient = jest.fn((modelId: string) => ({
  __kind: "openai",
  modelId,
}));
const mockCreateOpenAI = jest.fn(() => mockOpenAIClient);

// createOpenAICompatible is called once per build; return a fresh tagged
// client each call so we can read back which baseURL/name was used.
const mockCreateOpenAICompatible = jest.fn((config: { name: string }) => {
  const client = jest.fn((modelId: string) => ({
    __kind: "compatible",
    name: config.name,
    modelId,
  }));
  (client as unknown as { __config: unknown }).__config = config;
  return client;
});

const mockWrapLanguageModel = jest.fn(
  ({ model, middleware }: { model: unknown; middleware: unknown }) => ({
    __wrapped: true,
    model,
    middleware,
  })
);
const mockExtractReasoning = jest.fn((opts: unknown) => ({
  __middleware: "extract-reasoning",
  opts,
}));

jest.mock("ai", () => ({
  wrapLanguageModel: (...a: unknown[]) => mockWrapLanguageModel(...(a as [never])),
  extractReasoningMiddleware: (...a: unknown[]) =>
    mockExtractReasoning(...(a as [never])),
}));
jest.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: (...a: unknown[]) => mockCreateGoogle(...(a as [never])),
}));
jest.mock("@ai-sdk/openai", () => ({
  createOpenAI: (...a: unknown[]) => mockCreateOpenAI(...(a as [never])),
}));
jest.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: (...a: unknown[]) =>
    mockCreateOpenAICompatible(...(a as [never])),
}));

// Controllable env. provider.ts reads `env` from "@/env".
const mockEnv: Record<string, string> = {
  DEFAULT_LLM_PROVIDER: "gemini",
  GEMINI_API_KEY: "g-key",
  GEMINI_MODEL: "gemini-2.5-flash",
  OPENAI_API_KEY: "o-key",
  OPENAI_MODEL: "gpt-4o-mini",
  OPENROUTER_API_KEY: "or-key",
  OPENROUTER_MODEL: "openai/gpt-4o-mini",
  OPENROUTER_VISION_MODEL: "anthropic/claude-3.5-sonnet",
  NVIDIA_API_KEY: "n-key",
  NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
  NVIDIA_MODEL: "meta/llama-3.1-8b-instruct",
  OLLAMA_BASE_URL: "http://localhost:11434/",
  OLLAMA_MODEL: "llama3.2",
};
jest.mock("@/env", () => ({
  get env() {
    return mockEnv;
  },
}));

import {
  getModel,
  getMultimodalModel,
  supportsMultimodal,
  getModelLabel,
  isReasoningProvider,
  clearModelCache,
  type ProviderName,
} from "@/lib/ai/provider";

beforeEach(() => {
  jest.clearAllMocks();
  clearModelCache();
  mockEnv.DEFAULT_LLM_PROVIDER = "gemini";
});

describe("getModel - provider build wiring", () => {
  it("builds a Gemini model with the configured api key and model id", () => {
    const model = getModel("gemini") as unknown as { modelId: string };
    expect(mockCreateGoogle).toHaveBeenCalledWith({ apiKey: "g-key" });
    expect(mockGoogleClient).toHaveBeenCalledWith("gemini-2.5-flash");
    expect(model.modelId).toBe("gemini-2.5-flash");
  });

  it("builds an OpenAI model with the configured api key and model id", () => {
    const model = getModel("openai") as unknown as { modelId: string };
    expect(mockCreateOpenAI).toHaveBeenCalledWith({ apiKey: "o-key" });
    expect(mockOpenAIClient).toHaveBeenCalledWith("gpt-4o-mini");
    expect(model.modelId).toBe("gpt-4o-mini");
  });

  it("wraps OpenRouter with extract-reasoning middleware", () => {
    const model = getModel("openrouter") as unknown as { __wrapped: boolean };
    expect(mockExtractReasoning).toHaveBeenCalledWith({ tagName: "think" });
    expect(mockWrapLanguageModel).toHaveBeenCalled();
    expect(model.__wrapped).toBe(true);
    const cfg = mockCreateOpenAICompatible.mock.calls[0]![0];
    expect(cfg).toMatchObject({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "or-key",
    });
  });

  it("wraps NVIDIA with reasoning middleware and its configured base URL", () => {
    getModel("nvidia");
    const cfg = mockCreateOpenAICompatible.mock.calls[0]![0];
    expect(cfg).toMatchObject({
      name: "nvidia",
      baseURL: "https://integrate.api.nvidia.com/v1",
      apiKey: "n-key",
    });
    expect(mockWrapLanguageModel).toHaveBeenCalled();
  });

  it("builds Ollama against an OpenAI-compatible /v1 surface (single trailing slash collapsed)", () => {
    getModel("ollama");
    const cfg = mockCreateOpenAICompatible.mock.calls[0]![0];
    expect(cfg.name).toBe("ollama");
    expect(cfg.baseURL).toBe("http://localhost:11434/v1");
    expect(mockWrapLanguageModel).toHaveBeenCalled();
  });

  it("uses DEFAULT_LLM_PROVIDER when no provider is passed", () => {
    mockEnv.DEFAULT_LLM_PROVIDER = "openai";
    getModel();
    expect(mockCreateOpenAI).toHaveBeenCalled();
    expect(mockCreateGoogle).not.toHaveBeenCalled();
  });

  it("falls back to the ollama branch for an unknown provider", () => {
    getModel("mystery" as ProviderName);
    const cfg = mockCreateOpenAICompatible.mock.calls[0]![0];
    expect(cfg.name).toBe("ollama");
  });
});

describe("getModel - caching", () => {
  it("returns the same instance for repeated calls (cached per provider)", () => {
    const a = getModel("gemini");
    const b = getModel("gemini");
    expect(a).toBe(b);
    // build only happened once
    expect(mockGoogleClient).toHaveBeenCalledTimes(1);
  });

  it("clearModelCache forces a rebuild", () => {
    getModel("gemini");
    clearModelCache();
    getModel("gemini");
    expect(mockGoogleClient).toHaveBeenCalledTimes(2);
  });

  it("caches different providers independently", () => {
    const g = getModel("gemini");
    const o = getModel("openai");
    expect(g).not.toBe(o);
  });
});

describe("supportsMultimodal", () => {
  it.each(["gemini", "openai", "openrouter"] as ProviderName[])(
    "returns true for %s",
    (p) => {
      expect(supportsMultimodal(p)).toBe(true);
    }
  );

  it.each(["nvidia", "ollama"] as ProviderName[])(
    "returns false for %s",
    (p) => {
      expect(supportsMultimodal(p)).toBe(false);
    }
  );

  it("resolves the default provider when none is passed", () => {
    mockEnv.DEFAULT_LLM_PROVIDER = "ollama";
    expect(supportsMultimodal()).toBe(false);
  });
});

describe("getMultimodalModel", () => {
  it("uses the dedicated vision model for OpenRouter (not wrapped)", () => {
    const model = getMultimodalModel("openrouter") as unknown as {
      modelId: string;
    };
    expect(model.modelId).toBe("anthropic/claude-3.5-sonnet");
    // openrouter vision path does NOT go through wrapLanguageModel
    expect(mockWrapLanguageModel).not.toHaveBeenCalled();
  });

  it("reuses the text model for other providers (gemini)", () => {
    const a = getModel("gemini");
    const b = getMultimodalModel("gemini");
    expect(b).toBe(a);
  });
});

describe("getModelLabel", () => {
  it.each([
    ["gemini", "gemini:gemini-2.5-flash"],
    ["openai", "openai:gpt-4o-mini"],
    ["openrouter", "openrouter:openai/gpt-4o-mini"],
    ["nvidia", "nvidia:meta/llama-3.1-8b-instruct"],
    ["ollama", "ollama:llama3.2"],
  ] as [ProviderName, string][])("labels %s", (provider, expected) => {
    expect(getModelLabel(provider)).toBe(expected);
  });

  it("labels the default provider when none is passed", () => {
    mockEnv.DEFAULT_LLM_PROVIDER = "nvidia";
    expect(getModelLabel()).toBe("nvidia:meta/llama-3.1-8b-instruct");
  });
});

describe("isReasoningProvider", () => {
  it.each(["gemini", "nvidia", "openrouter", "ollama"] as ProviderName[])(
    "returns true for %s",
    (p) => {
      expect(isReasoningProvider(p)).toBe(true);
    }
  );

  it("returns false for openai", () => {
    expect(isReasoningProvider("openai")).toBe(false);
  });

  it("resolves the default provider when none is passed", () => {
    mockEnv.DEFAULT_LLM_PROVIDER = "openai";
    expect(isReasoningProvider()).toBe(false);
  });
});
