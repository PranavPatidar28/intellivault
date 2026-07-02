/**
 * LLM model registry (Vercel AI SDK).
 *
 * Maps the configured DEFAULT_LLM_PROVIDER to a single AI SDK LanguageModel.
 * Services call getModel() / getMultimodalModel() and never touch provider
 * packages directly. There is intentionally NO automatic multi-provider
 * fallback — one configured provider, predictable cost and behavior.
 *
 * Reasoning handling: OpenAI-compatible models (NVIDIA, OpenRouter) are wrapped
 * with extractReasoningMiddleware so inline <think>…</think> content is pulled
 * OUT of the answer text into a separate `reasoning` channel. Providers that
 * return native reasoning (Gemini thinking, models exposing reasoning_content)
 * surface it automatically. This is what prevents reasoning tokens from being
 * stored as note content.
 */

import { wrapLanguageModel, type LanguageModel } from "ai";
import { extractFlexibleReasoningMiddleware } from "./flexible-reasoning-middleware";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/env";

export type ProviderName = "gemini" | "openai" | "openrouter" | "nvidia" | "ollama";

function resolveProvider(provider?: ProviderName): ProviderName {
  return (provider || env.DEFAULT_LLM_PROVIDER) as ProviderName;
}

/** Build a fresh model instance for a provider (uncached). */
function buildModel(provider: ProviderName): LanguageModel {
  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
      return google(env.GEMINI_MODEL);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
      return openai(env.OPENAI_MODEL);
    }
    case "openrouter": {
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY,
        headers: {
          "HTTP-Referer": "https://intellivault.app",
          "X-Title": "IntelliVault",
        },
      });
      // Extract inline <think> and gemma reasoning; no-op when the model emits none.
      return wrapLanguageModel({
        model: openrouter(env.OPENROUTER_MODEL),
        middleware: extractFlexibleReasoningMiddleware(),
      });
    }
    case "nvidia": {
      const nvidia = createOpenAICompatible({
        name: "nvidia",
        baseURL: env.NVIDIA_BASE_URL,
        apiKey: env.NVIDIA_API_KEY,
      });
      return wrapLanguageModel({
        model: nvidia(env.NVIDIA_MODEL),
        middleware: extractFlexibleReasoningMiddleware(),
      });
    }
    case "ollama":
    default: {
      // Ollama exposes an OpenAI-compatible surface at /v1.
      const ollama = createOpenAICompatible({
        name: "ollama",
        baseURL: env.OLLAMA_BASE_URL.replace(/\/$/, "") + "/v1",
        apiKey: "ollama", // ignored by Ollama, but the client requires a value
      });
      return wrapLanguageModel({
        model: ollama(env.OLLAMA_MODEL),
        middleware: extractFlexibleReasoningMiddleware(),
      });
    }
  }
}

// Cache one model instance per provider for the process lifetime.
const modelCache = new Map<ProviderName, LanguageModel>();

export function getModel(provider?: ProviderName): LanguageModel {
  const name = resolveProvider(provider);
  const cached = modelCache.get(name);
  if (cached) return cached;
  const model = buildModel(name);
  modelCache.set(name, model);
  return model;
}

/** Providers whose chat models accept image parts. */
const MULTIMODAL_PROVIDERS = new Set<ProviderName>(["gemini", "openai", "openrouter"]);

export function supportsMultimodal(provider?: ProviderName): boolean {
  return MULTIMODAL_PROVIDERS.has(resolveProvider(provider));
}

/**
 * Vision-capable model. For OpenRouter the vision model id can differ from the
 * text model, so use OPENROUTER_VISION_MODEL there; other providers reuse the
 * text model (Gemini/OpenAI chat models are natively multimodal).
 */
export function getMultimodalModel(provider?: ProviderName): LanguageModel {
  const name = resolveProvider(provider);
  if (name === "openrouter") {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      headers: {
        "HTTP-Referer": "https://intellivault.app",
        "X-Title": "IntelliVault",
      },
    });
    return openrouter(env.OPENROUTER_VISION_MODEL);
  }
  return getModel(name);
}

/** Human-readable provider:model label for provenance records. */
export function getModelLabel(provider?: ProviderName): string {
  const name = resolveProvider(provider);
  const modelId: Record<ProviderName, string> = {
    gemini: env.GEMINI_MODEL,
    openai: env.OPENAI_MODEL,
    openrouter: env.OPENROUTER_MODEL,
    nvidia: env.NVIDIA_MODEL,
    ollama: env.OLLAMA_MODEL,
  };
  return `${name}:${modelId[name]}`;
}

/** Whether the configured provider can emit reasoning the UI may want to show. */
export function isReasoningProvider(provider?: ProviderName): boolean {
  const name = resolveProvider(provider);
  return name === "gemini" || name === "nvidia" || name === "openrouter" || name === "ollama";
}

/** Test/maintenance helper: clear the model cache (e.g. after env changes). */
export function clearModelCache(): void {
  modelCache.clear();
}
