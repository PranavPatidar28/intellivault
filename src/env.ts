import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL").optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Pinecone configuration
  PINECONE_API_KEY: z.string().min(1, "PINECONE_API_KEY is required").optional(),
  PINECONE_INDEX_HOST: z.string().url("PINECONE_INDEX_HOST must be a valid URL").optional(),
  PINECONE_INDEX_NAME: z.string().min(1, "PINECONE_INDEX_NAME is required").optional(),
  // LLM Provider configuration
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2"),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  DEFAULT_LLM_PROVIDER: z.enum(["ollama", "gemini", "openai", "openrouter"]).default("ollama"),
  // AI Feature flags
  AI_AUTO_SUMMARIZE: z.coerce.boolean().default(false),
  AI_AUTO_TAG: z.coerce.boolean().default(false),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );
  // Fail fast in production: missing secrets like BETTER_AUTH_SECRET or
  // DATABASE_URL must not be allowed to silently fall back to raw process.env,
  // which leads to confusing runtime auth/db failures. During build (when the
  // values are often injected later) we tolerate it.
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error(
      "Invalid environment variables. See logged field errors above."
    );
  }
}

export const env = parsed.success
  ? parsed.data
  : (process.env as unknown as z.infer<typeof envSchema>);
