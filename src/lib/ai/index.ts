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

// LLM provider registry (Vercel AI SDK)
export {
  getModel,
  getMultimodalModel,
  supportsMultimodal,
  getModelLabel,
  isReasoningProvider,
  type ProviderName,
} from "./provider";

// LLM generation primitives
export {
  genText,
  genObject,
  genTextStream,
  genFullStream,
  genMultimodal,
  EmptyContentError,
  type GenOptions,
  type GenResult,
  type StreamPart,
  type MultimodalPart,
} from "./generate";

// Content extraction for multimodal
export {
  extractContentFromJSON,
  validateContentForSummary,
  prepareMultimodalContent,
  fetchImageAsBase64,
  needsMultimodalProcessing,
  type ExtractedContent,
  type ExtractedImage,
  type ContentValidation,
  type ContextOptions,
} from "./content-extractor";

// AI Summarization
export {
  generateSummary,
  generateSummaryStream,
  generateSummaryMultimodal,
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
