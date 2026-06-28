/**
 * LLM generation primitives (Vercel AI SDK).
 *
 * Thin wrappers over the AI SDK that the service layer calls. Centralizes:
 * - timeouts (AbortSignal)
 * - the empty-content guard (reasoning models that emit no answer)
 * - structured output via Zod (replaces brittle regex JSON extraction)
 * - reasoning separation for streaming.
 */

import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
  generateObject as aiGenerateObject,
  NoObjectGeneratedError,
  type LanguageModel,
} from "ai";
import type { ZodType } from "zod";
import { getModel, getModelLabel, getMultimodalModel } from "./provider";

const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Multimodal content part (text or base64 image). Kept here so consumers
 * (content-extractor, summarization-service) import it from the AI module
 * without depending on the deleted llm-provider.
 */
export interface MultimodalPart {
  type: "text" | "image";
  text?: string;
  base64Data?: string;
  mimeType?: string;
}

type JSONValue =
  | null
  | string
  | number
  | boolean
  | { [key: string]: JSONValue }
  | JSONValue[];

export interface GenOptions {
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: LanguageModel;
  /** Provider-specific options, e.g. { google: { thinkingConfig: { thinkingBudget: 0 } } }. */
  providerOptions?: Record<string, Record<string, JSONValue>>;
}

export interface GenResult {
  text: string;
  reasoning?: string;
  usage?: { inputTokens: number; outputTokens: number };
  provider: string;
  latencyMs: number;
}

/**
 * Thrown when a (reasoning) model returns empty answer text while spending its
 * budget on reasoning. Callers catch this and fall back rather than silently
 * persisting an empty string.
 */
export class EmptyContentError extends Error {
  constructor(message = "Model returned empty content") {
    super(message);
    this.name = "EmptyContentError";
  }
}

function signal(timeoutMs?: number): AbortSignal {
  const ms = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // AbortSignal.timeout is available in Node 17.3+ and all modern browsers,
  // but fall back to a manual controller for environments that lack it.
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function usageOf(u: { inputTokens?: number; outputTokens?: number } | undefined) {
  if (!u) return undefined;
  return {
    inputTokens: u.inputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
  };
}

/**
 * Detect errors that mean "this provider can't reliably do native structured
 * output" (json_schema response format not supported, or the model returned
 * output the schema validator rejected), so genObject can fall back to
 * instructed JSON.
 */
function isStructuredOutputUnsupported(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error)) return true;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("responseformat") ||
    msg.includes("response_format") ||
    msg.includes("structuredoutput") ||
    msg.includes("structured outputs") ||
    msg.includes("json_schema") ||
    msg.includes("json schema") ||
    msg.includes("did not match schema") ||
    msg.includes("no object generated") ||
    msg.includes("not supported") ||
    msg.includes("does not support")
  );
}

/**
 * Extract a JSON object/array from raw model text. Tolerates markdown code
 * fences and surrounding prose. Throws if no JSON can be found/parsed.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Strip ```json ... ``` fences if present.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the first {...} or [...] span.
    const objMatch = candidate.match(/[{[][\s\S]*[}\]]/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error("No JSON object found in model output");
  }
}

/**
 * Non-streaming text generation. Throws EmptyContentError when the model
 * produced reasoning but no answer text.
 */
export async function genText(prompt: string, opts: GenOptions = {}): Promise<GenResult> {
  const start = Date.now();
  const model = opts.model ?? getModel();

  const result = await aiGenerateText({
    model,
    system: opts.system,
    prompt,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    abortSignal: signal(opts.timeoutMs),
    providerOptions: opts.providerOptions,
  });

  const text = result.text ?? "";
  const reasoning = result.reasoningText || undefined;

  if (text.trim() === "" && reasoning) {
    throw new EmptyContentError(
      "Model returned reasoning but no answer text; check the configured model."
    );
  }

  return {
    text,
    reasoning,
    usage: usageOf(result.usage),
    provider: getModelLabel(),
    latencyMs: Date.now() - start,
  };
}

/**
 * Structured output via Zod. Tries the provider's native structured-output
 * mode first (Gemini/OpenAI); if the provider doesn't support it (NVIDIA,
 * Ollama, many OpenAI-compatible endpoints), falls back to a JSON-instructed
 * text generation that is still validated against the same Zod schema. Either
 * way the result is schema-checked — no brittle regex extraction.
 */
export async function genObject<T>(
  prompt: string,
  schema: ZodType<T>,
  opts: GenOptions = {}
): Promise<{ object: T; reasoning?: string; provider: string; latencyMs: number }> {
  const start = Date.now();
  const model = opts.model ?? getModel();

  try {
    const result = await aiGenerateObject({
      model,
      schema,
      system: opts.system,
      prompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      abortSignal: signal(opts.timeoutMs),
      providerOptions: opts.providerOptions,
    });

    return {
      object: result.object as T,
      reasoning: (result as { reasoningText?: string }).reasoningText || undefined,
      provider: getModelLabel(),
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    // Some providers/models don't support the json_schema response format.
    // Fall back to instructed-JSON text generation + Zod validation.
    if (!isStructuredOutputUnsupported(error)) throw error;

    const jsonPrompt = `${prompt}

Respond with ONLY a single valid JSON object that satisfies the required structure. No markdown fences, no commentary, no text before or after the JSON.`;

    const result = await aiGenerateText({
      model,
      system: opts.system,
      prompt: jsonPrompt,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
      abortSignal: signal(opts.timeoutMs),
      providerOptions: opts.providerOptions,
    });

    const parsed = extractJson(result.text);
    const object = schema.parse(parsed); // throws if it still doesn't match

    return {
      object,
      reasoning: result.reasoningText || undefined,
      provider: getModelLabel(),
      latencyMs: Date.now() - start,
    };
  }
}

/** Streaming text only (reasoning is NOT included in this iterator). */
export async function* genTextStream(
  prompt: string,
  opts: GenOptions = {}
): AsyncGenerator<string, void, unknown> {
  const model = opts.model ?? getModel();

  const result = aiStreamText({
    model,
    system: opts.system,
    prompt,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    abortSignal: signal(opts.timeoutMs),
    providerOptions: opts.providerOptions,
  });

  for await (const chunk of result.textStream) {
    if (chunk) yield chunk;
  }
}

export type StreamPart =
  | { kind: "text"; value: string }
  | { kind: "reasoning"; value: string };

/**
 * Streaming with reasoning separated from text. Routes use this to emit a
 * distinct reasoning SSE event while content streams normally.
 */
export async function* genFullStream(
  prompt: string,
  opts: GenOptions = {}
): AsyncGenerator<StreamPart, void, unknown> {
  const model = opts.model ?? getModel();

  const result = aiStreamText({
    model,
    system: opts.system,
    prompt,
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    abortSignal: signal(opts.timeoutMs),
    providerOptions: opts.providerOptions,
  });

  for await (const part of result.fullStream) {
    // The delta payload field name varies across SDK overloads; read defensively.
    const p = part as { type: string; delta?: string; text?: string; textDelta?: string; error?: unknown };
    if (p.type === "text-delta") {
      const value = p.delta ?? p.text ?? p.textDelta ?? "";
      if (value) yield { kind: "text", value };
    } else if (p.type === "reasoning-delta") {
      const value = p.delta ?? p.text ?? p.textDelta ?? "";
      if (value) yield { kind: "reasoning", value };
    } else if (p.type === "error") {
      throw p.error instanceof Error ? p.error : new Error(String(p.error));
    }
  }
}

/** Multimodal generation (text + base64 images). */
export async function genMultimodal(
  parts: MultimodalPart[],
  opts: GenOptions = {}
): Promise<GenResult> {
  const start = Date.now();
  const model = opts.model ?? getMultimodalModel();

  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string }
  > = [];
  for (const part of parts) {
    if (part.type === "text" && part.text) {
      content.push({ type: "text", text: part.text });
    } else if (part.type === "image" && part.base64Data) {
      content.push({
        type: "image",
        image: `data:${part.mimeType || "image/jpeg"};base64,${part.base64Data}`,
      });
    }
  }

  const result = await aiGenerateText({
    model,
    system: opts.system,
    messages: [{ role: "user", content }],
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
    abortSignal: signal(opts.timeoutMs),
    providerOptions: opts.providerOptions,
  });

  const text = result.text ?? "";
  const reasoning = result.reasoningText || undefined;

  if (text.trim() === "" && reasoning) {
    throw new EmptyContentError(
      "Model returned reasoning but no answer text; check the configured model."
    );
  }

  return {
    text,
    reasoning,
    usage: usageOf(result.usage),
    provider: getModelLabel(),
    latencyMs: Date.now() - start,
  };
}
