/**
 * AI Services Barrel Export
 * 
 * Convenience re-exports for all AI-related functionality.
 */

// Pinecone client and utilities
export {
  getPinecone,
  getNotesIndex,
  getUserNamespace,
  getChunkId,
  parseChunkId,
  type ChunkMetadata,
  type ChunkRecord,
  type SearchHit,
} from "./pinecone";

// Text chunking
export {
  chunkText,
  getPreview,
  estimateChunkCount,
  type TextChunk,
  type ChunkOptions,
} from "./chunker";

// Pinecone CRUD operations
export {
  upsertNoteChunks,
  deleteNoteVectors,
  searchNotes,
  checkPineconeHealth,
  type SemanticSearchResult,
  type UpsertResult,
} from "./pinecone-service";

// Embedding orchestration
export {
  embedNote,
  processEmbeddingQueue,
  markNoteForReembedding,
  handleNoteDeleted,
  getQueueStatus,
  reembedAllNotes,
  type EmbedNoteResult,
  type ProcessQueueResult,
  type QueueStatus,
} from "./embedding-sync";

// LLM provider abstraction
export {
  generateText,
  getAvailableProvider,
  getProviderStatus,
  getAllProviders,
  OllamaProvider,
  GeminiProvider,
  OpenAIProvider,
  type LLMProvider,
  type LLMOptions,
  type LLMResponse,
} from "./llm-provider";

// AI Summarization
export {
  generateSummary,
  generateTitle,
  generateContentHash,
  hasContentChanged,
  type SummarizationOptions,
  type SummarizationResult,
  type SummaryLength,
  type SummaryStyle,
} from "./summarization-service";

// Auto-tagging
export {
  suggestTags,
  autoTagNote,
  applyTagsToNote,
  generateSlug,
  type TagSuggestion,
  type AutoTagOptions,
  type AutoTagResult,
} from "./auto-tagging-service";
