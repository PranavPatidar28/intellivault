/**
 * Text Chunking Utility
 *
 * Splits text into overlapping chunks suitable for embedding.
 * Uses sentence-aware splitting to avoid cutting mid-sentence.
 */

export interface TextChunk {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface ChunkOptions {
  /** Maximum characters per chunk (default: 500) */
  chunkSize?: number;
  /** Number of overlapping characters between chunks (default: 100) */
  overlap?: number;
  /** Minimum chunk size - chunks smaller than this are merged with previous (default: 50) */
  minChunkSize?: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  chunkSize: 1500,
  overlap: 200,
  minChunkSize: 100,
};

/**
 * Split text into sentences (basic implementation)
 * Handles common sentence endings: . ! ? and newlines
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or newline
  // Also split on double newlines (paragraph breaks)
  const sentencePattern = /(?<=[.!?])\s+|\n\n+/g;
  const sentences = text.split(sentencePattern).filter((s) => s.trim().length > 0);
  return sentences;
}

/**
 * Find the best split point near the target position
 * Prefers sentence boundaries, then word boundaries
 */
function findSplitPoint(text: string, targetPos: number, maxLookback: number = 100): number {
  if (targetPos >= text.length) return text.length;

  // Look for sentence boundary (. ! ?) before target
  const lookbackStart = Math.max(0, targetPos - maxLookback);
  const lookbackText = text.slice(lookbackStart, targetPos);

  // Find last sentence ending
  const sentenceEndMatch = lookbackText.match(/[.!?]\s*$/);
  if (sentenceEndMatch && sentenceEndMatch.index !== undefined) {
    return lookbackStart + sentenceEndMatch.index + sentenceEndMatch[0].length;
  }

  // Look for word boundary (space) before target
  const spaceMatch = lookbackText.match(/\s+$/);
  if (spaceMatch && spaceMatch.index !== undefined) {
    return lookbackStart + spaceMatch.index + spaceMatch[0].length;
  }

  // No good boundary found, use target position
  return targetPos;
}

/**
 * Chunk text into overlapping segments
 *
 * @param text - The text to chunk
 * @param options - Chunking options
 * @returns Array of text chunks with metadata
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, overlap, minChunkSize } = opts;

  // Handle empty or very short text
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();

  // If text is shorter than chunk size, return as single chunk
  if (normalizedText.length <= chunkSize) {
    return [
      {
        index: 0,
        text: normalizedText,
        startOffset: 0,
        endOffset: normalizedText.length,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let currentPos = 0;
  let chunkIndex = 0;

  while (currentPos < normalizedText.length) {
    // Calculate end position for this chunk
    let endPos = Math.min(currentPos + chunkSize, normalizedText.length);

    // If not at the end, find a good split point
    if (endPos < normalizedText.length) {
      endPos = findSplitPoint(normalizedText, endPos);
    }

    // Extract chunk text
    const chunkText = normalizedText.slice(currentPos, endPos).trim();

    // Only add if chunk meets minimum size (or it's the last chunk)
    if (chunkText.length >= minChunkSize || currentPos + chunkSize >= normalizedText.length) {
      chunks.push({
        index: chunkIndex,
        text: chunkText,
        startOffset: currentPos,
        endOffset: endPos,
      });
      chunkIndex++;
    }

    // Move to next position with overlap
    const nextPos = endPos - overlap;

    // Ensure we make progress
    if (nextPos <= currentPos) {
      currentPos = endPos;
    } else {
      currentPos = nextPos;
    }

    // Break if we've processed everything
    if (endPos >= normalizedText.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Get a preview of text (first N characters, ending at word boundary)
 */
export function getPreview(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * Estimate the number of chunks for a given text length
 */
export function estimateChunkCount(
  textLength: number,
  options: ChunkOptions = {}
): number {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, overlap } = opts;

  if (textLength <= chunkSize) return 1;

  // Effective chunk step (chunk size minus overlap)
  const step = chunkSize - overlap;
  return Math.ceil((textLength - overlap) / step);
}
