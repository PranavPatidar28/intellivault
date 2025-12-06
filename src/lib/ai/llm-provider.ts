/**
 * LLM Provider Abstraction Layer
 *
 * Provides a unified interface for multiple LLM providers (Ollama, Gemini, OpenAI)
 * with automatic fallback and retry logic.
 */

import { env } from "@/env";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface LLMOptions {
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Temperature for response randomness (0-1) */
    temperature?: number;
    /** System prompt for context */
    systemPrompt?: string;
    /** Timeout in milliseconds */
    timeout?: number;
}

export interface LLMResponse {
    /** Generated text */
    text: string;
    /** Token usage statistics */
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    /** Provider that generated the response */
    provider: string;
    /** Time taken in milliseconds */
    latencyMs?: number;
}

export interface LLMProvider {
    /** Provider name */
    name: string;
    /** Check if provider is available and configured */
    isAvailable(): Promise<boolean>;
    /** Generate text from a prompt */
    generateText(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
    /** Generate text with streaming */
    generateTextStream(prompt: string, options?: LLMOptions): AsyncGenerator<string, void, unknown>;
    /** Estimate cost for token usage (in USD) */
    estimateCost(inputTokens: number, outputTokens: number): number;
}

// ============================================================================
// Ollama Provider (Local)
// ============================================================================

export class OllamaProvider implements LLMProvider {
    name = "ollama";
    private baseUrl: string;
    private model: string;

    constructor(baseUrl?: string, model?: string) {
        this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        this.model = model || process.env.OLLAMA_MODEL || "llama3.2";
    }

    async isAvailable(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${this.baseUrl}/api/tags`, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response.ok;
        } catch {
            return false;
        }
    }

    async generateText(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
        const startTime = Date.now();
        const timeout = options?.timeout || 60000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const requestBody: Record<string, unknown> = {
                model: this.model,
                prompt: options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
                stream: false,
                options: {
                    temperature: options?.temperature ?? 0.7,
                },
            };

            if (options?.maxTokens) {
                (requestBody.options as Record<string, unknown>).num_predict = options.maxTokens;
            }

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            return {
                text: data.response || "",
                usage: data.prompt_eval_count && data.eval_count ? {
                    inputTokens: data.prompt_eval_count,
                    outputTokens: data.eval_count,
                } : undefined,
                provider: this.name,
                latencyMs: Date.now() - startTime,
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Ollama request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    async *generateTextStream(prompt: string, options?: LLMOptions): AsyncGenerator<string, void, unknown> {
        const timeout = options?.timeout || 60000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const requestBody: Record<string, unknown> = {
                model: this.model,
                prompt: options?.systemPrompt ? `${options.systemPrompt}\n\n${prompt}` : prompt,
                stream: true,
                options: {
                    temperature: options?.temperature ?? 0.7,
                },
            };

            if (options?.maxTokens) {
                (requestBody.options as Record<string, unknown>).num_predict = options.maxTokens;
            }

            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            yield data.response;
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Ollama request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    estimateCost(): number {
        return 0; // Ollama is free (local)
    }
}

// ============================================================================
// Gemini Provider (Google AI)
// ============================================================================

export class GeminiProvider implements LLMProvider {
    name = "gemini";
    private apiKey: string | undefined;
    private model: string;
    private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

    constructor(apiKey?: string, model?: string) {
        this.apiKey = apiKey || process.env.GEMINI_API_KEY;
        this.model = model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
    }

    async isAvailable(): Promise<boolean> {
        return !!this.apiKey;
    }

    async generateText(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
        if (!this.apiKey) {
            throw new Error("Gemini API key not configured");
        }

        const startTime = Date.now();
        const timeout = options?.timeout || 30000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const contents = [];

            if (options?.systemPrompt) {
                contents.push({
                    role: "user",
                    parts: [{ text: options.systemPrompt }],
                });
                contents.push({
                    role: "model",
                    parts: [{ text: "Understood. I will follow these instructions." }],
                });
            }

            contents.push({
                role: "user",
                parts: [{ text: prompt }],
            });

            const requestBody: Record<string, unknown> = {
                contents,
                generationConfig: {
                    temperature: options?.temperature ?? 0.7,
                    maxOutputTokens: options?.maxTokens || 1024,
                },
            };

            const response = await fetch(
                `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `Gemini API error: ${response.status} ${errorData.error?.message || response.statusText}`
                );
            }

            const data = await response.json();
            const candidate = data.candidates?.[0];
            const text = candidate?.content?.parts?.[0]?.text || "";

            return {
                text,
                usage: data.usageMetadata ? {
                    inputTokens: data.usageMetadata.promptTokenCount || 0,
                    outputTokens: data.usageMetadata.candidatesTokenCount || 0,
                } : undefined,
                provider: this.name,
                latencyMs: Date.now() - startTime,
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Gemini request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    async *generateTextStream(prompt: string, options?: LLMOptions): AsyncGenerator<string, void, unknown> {
        if (!this.apiKey) {
            throw new Error("Gemini API key not configured");
        }

        const timeout = options?.timeout || 60000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const contents = [];

            if (options?.systemPrompt) {
                contents.push({
                    role: "user",
                    parts: [{ text: options.systemPrompt }],
                });
                contents.push({
                    role: "model",
                    parts: [{ text: "Understood. I will follow these instructions." }],
                });
            }

            contents.push({
                role: "user",
                parts: [{ text: prompt }],
            });

            const requestBody: Record<string, unknown> = {
                contents,
                generationConfig: {
                    temperature: options?.temperature ?? 0.7,
                    maxOutputTokens: options?.maxTokens || 1024,
                },
            };

            const response = await fetch(
                `${this.baseUrl}/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `Gemini API error: ${response.status} ${errorData.error?.message || response.statusText}`
                );
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6);
                    if (!jsonStr.trim()) continue;
                    try {
                        const data = JSON.parse(jsonStr);
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            yield text;
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`Gemini request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    estimateCost(inputTokens: number, outputTokens: number): number {
        // Gemini 1.5 Flash pricing (as of Dec 2024)
        // $0.075 per 1M input tokens, $0.30 per 1M output tokens
        return (inputTokens * 0.000000075) + (outputTokens * 0.0000003);
    }
}

// ============================================================================
// OpenAI Provider
// ============================================================================

export class OpenAIProvider implements LLMProvider {
    name = "openai";
    private apiKey: string | undefined;
    private model: string;
    private baseUrl = "https://api.openai.com/v1";

    constructor(apiKey?: string, model?: string) {
        this.apiKey = apiKey || process.env.OPENAI_API_KEY;
        this.model = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    }

    async isAvailable(): Promise<boolean> {
        return !!this.apiKey;
    }

    async generateText(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
        if (!this.apiKey) {
            throw new Error("OpenAI API key not configured");
        }

        const startTime = Date.now();
        const timeout = options?.timeout || 30000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const messages = [];

            if (options?.systemPrompt) {
                messages.push({
                    role: "system",
                    content: options.systemPrompt,
                });
            }

            messages.push({
                role: "user",
                content: prompt,
            });

            const requestBody: Record<string, unknown> = {
                model: this.model,
                messages,
                temperature: options?.temperature ?? 0.7,
            };

            if (options?.maxTokens) {
                requestBody.max_tokens = options.maxTokens;
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`
                );
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || "";

            return {
                text,
                usage: data.usage ? {
                    inputTokens: data.usage.prompt_tokens || 0,
                    outputTokens: data.usage.completion_tokens || 0,
                } : undefined,
                provider: this.name,
                latencyMs: Date.now() - startTime,
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`OpenAI request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    async *generateTextStream(prompt: string, options?: LLMOptions): AsyncGenerator<string, void, unknown> {
        if (!this.apiKey) {
            throw new Error("OpenAI API key not configured");
        }

        const timeout = options?.timeout || 60000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const messages = [];

            if (options?.systemPrompt) {
                messages.push({
                    role: "system",
                    content: options.systemPrompt,
                });
            }

            messages.push({
                role: "user",
                content: prompt,
            });

            const requestBody: Record<string, unknown> = {
                model: this.model,
                messages,
                temperature: options?.temperature ?? 0.7,
                stream: true,
            };

            if (options?.maxTokens) {
                requestBody.max_tokens = options.maxTokens;
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `OpenAI API error: ${response.status} ${errorData.error?.message || response.statusText}`
                );
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6);
                    if (jsonStr === "[DONE]") break;
                    if (!jsonStr.trim()) continue;
                    try {
                        const data = JSON.parse(jsonStr);
                        const text = data.choices?.[0]?.delta?.content;
                        if (text) {
                            yield text;
                        }
                    } catch {
                        // Skip malformed JSON
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`OpenAI request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    estimateCost(inputTokens: number, outputTokens: number): number {
        // GPT-4o-mini pricing (as of Dec 2024)
        // $0.15 per 1M input tokens, $0.60 per 1M output tokens
        return (inputTokens * 0.00000015) + (outputTokens * 0.0000006);
    }
}

// ============================================================================
// OpenRouter Provider (Multi-model gateway)
// ============================================================================

export class OpenRouterProvider implements LLMProvider {
    name = "openrouter";
    private apiKey: string | undefined;
    private model: string;
    private baseUrl = "https://openrouter.ai/api/v1";

    constructor(apiKey?: string, model?: string) {
        this.apiKey = apiKey || process.env.OPENROUTER_API_KEY;
        this.model = model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    }

    async isAvailable(): Promise<boolean> {
        return !!this.apiKey;
    }

    async generateText(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
        if (!this.apiKey) {
            throw new Error("OpenRouter API key not configured");
        }

        const startTime = Date.now();
        const timeout = options?.timeout || 30000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const messages = [];

            if (options?.systemPrompt) {
                messages.push({
                    role: "system",
                    content: options.systemPrompt,
                });
            }

            messages.push({
                role: "user",
                content: prompt,
            });

            const requestBody: Record<string, unknown> = {
                model: this.model,
                messages,
                temperature: options?.temperature ?? 0.7,
            };

            if (options?.maxTokens) {
                requestBody.max_tokens = options.maxTokens;
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                    "HTTP-Referer": "https://intellivault.app",
                    "X-Title": "IntelliVault",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `OpenRouter API error: ${response.status} ${errorData.error?.message || response.statusText}`
                );
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || "";

            return {
                text,
                usage: data.usage ? {
                    inputTokens: data.usage.prompt_tokens || 0,
                    outputTokens: data.usage.completion_tokens || 0,
                } : undefined,
                provider: this.name,
                latencyMs: Date.now() - startTime,
            };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`OpenRouter request timed out after ${timeout}ms`);
            }
            throw error;
        }
    }

    async *generateTextStream(prompt: string, options?: LLMOptions): AsyncGenerator<string, void, unknown> {
        if (!this.apiKey) {
            throw new Error("OpenRouter API key not configured");
        }

        const timeout = options?.timeout || 60000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

        try {
            const messages = [];

            if (options?.systemPrompt) {
                messages.push({
                    role: "system",
                    content: options.systemPrompt,
                });
            }

            messages.push({
                role: "user",
                content: prompt,
            });

            const requestBody: Record<string, unknown> = {
                model: this.model,
                messages,
                temperature: options?.temperature ?? 0.7,
                stream: true,
            };

            if (options?.maxTokens) {
                requestBody.max_tokens = options.maxTokens;
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    "HTTP-Referer": "https://intellivault.app",
                    "X-Title": "IntelliVault",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(
                    `OpenRouter API error: ${response.status} ${errorData.error?.message || response.statusText}`
                );
            }

            reader = response.body?.getReader();
            if (!reader) {
                throw new Error("Response body is not readable");
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Append new chunk to buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete lines from buffer
                while (true) {
                    const lineEnd = buffer.indexOf("\n");
                    if (lineEnd === -1) break;

                    const line = buffer.slice(0, lineEnd).trim();
                    buffer = buffer.slice(lineEnd + 1);

                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") break;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                yield content;
                            }
                        } catch {
                            // Ignore invalid JSON
                        }
                    }
                }
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error(`OpenRouter request timed out after ${timeout}ms`);
            }
            throw error;
        } finally {
            if (reader) {
                try {
                    reader.cancel();
                } catch {
                    // Ignore cancel errors
                }
            }
        }
    }

    estimateCost(inputTokens: number, outputTokens: number): number {
        // Cost varies by model - using GPT-4o-mini as default estimate
        // OpenRouter adds ~5% markup over direct provider pricing
        return (inputTokens * 0.00000016) + (outputTokens * 0.00000063);
    }
}

// ============================================================================
// Provider Factory & Cache
// ============================================================================

let cachedProviders: LLMProvider[] | null = null;

/**
 * Get all configured LLM providers in priority order
 */
export function getAllProviders(): LLMProvider[] {
    if (cachedProviders) return cachedProviders;

    const providers: LLMProvider[] = [];

    // Priority order based on environment config or default
    const defaultProvider = process.env.DEFAULT_LLM_PROVIDER || "ollama";

    const ollamaProvider = new OllamaProvider();
    const geminiProvider = new GeminiProvider();
    const openaiProvider = new OpenAIProvider();
    const openrouterProvider = new OpenRouterProvider();

    // Add in priority order
    if (defaultProvider === "openrouter") {
        providers.push(openrouterProvider, geminiProvider, openaiProvider, ollamaProvider);
    } else if (defaultProvider === "gemini") {
        providers.push(geminiProvider, openrouterProvider, openaiProvider, ollamaProvider);
    } else if (defaultProvider === "openai") {
        providers.push(openaiProvider, openrouterProvider, geminiProvider, ollamaProvider);
    } else {
        providers.push(ollamaProvider, geminiProvider, openaiProvider, openrouterProvider);
    }

    cachedProviders = providers;
    return providers;
}

/**
 * Get the first available LLM provider
 */
export async function getAvailableProvider(): Promise<LLMProvider | null> {
    const providers = getAllProviders();

    for (const provider of providers) {
        if (await provider.isAvailable()) {
            return provider;
        }
    }

    return null;
}

/**
 * Generate text using the first available provider with automatic fallback
 */
export async function generateText(
    prompt: string,
    options?: LLMOptions
): Promise<LLMResponse> {
    const providers = getAllProviders();
    const errors: string[] = [];

    for (const provider of providers) {
        try {
            if (await provider.isAvailable()) {
                return await provider.generateText(prompt, options);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            errors.push(`${provider.name}: ${message}`);
            console.warn(`LLM provider ${provider.name} failed:`, message);
            // Continue to next provider
        }
    }

    throw new Error(`All LLM providers failed: ${errors.join("; ")}`);
}

/**
 * Check which providers are currently available
 */
export async function getProviderStatus(): Promise<
    Array<{ name: string; available: boolean }>
> {
    const providers = getAllProviders();
    const results = await Promise.all(
        providers.map(async (p) => ({
            name: p.name,
            available: await p.isAvailable(),
        }))
    );
    return results;
}

/**
 * Stream text generation using the first available provider with automatic fallback
 */
export async function* streamText(
    prompt: string,
    options?: LLMOptions
): AsyncGenerator<string, void, unknown> {
    const providers = getAllProviders();
    const errors: string[] = [];

    for (const provider of providers) {
        try {
            if (await provider.isAvailable()) {
                yield* provider.generateTextStream(prompt, options);
                return;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            errors.push(`${provider.name}: ${message}`);
            console.warn(`LLM provider ${provider.name} streaming failed:`, message);
            // Continue to next provider
        }
    }

    throw new Error(`All LLM providers failed to stream: ${errors.join("; ")}`);
}
