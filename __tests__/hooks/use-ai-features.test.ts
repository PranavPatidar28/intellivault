import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util';
// jsdom does not provide TextEncoder/TextDecoder; polyfill for the stream helpers.
if (typeof global.TextEncoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).TextEncoder = NodeTextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).TextDecoder = NodeTextDecoder;
}

import { renderHook, act } from '@testing-library/react';
import {
  useSummarize,
  useAutoTag,
  useAIFeatures,
} from '@/hooks/use-ai-features';

const toastError = jest.fn();
const toastSuccess = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

global.fetch = jest.fn();

/**
 * Build a ReadableStream-like reader yielding the given SSE text chunks, then
 * done. Returns the shape `response.body.getReader()` provides.
 */
function makeStreamResponse(chunks: string[], ok = true, status = 200) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok,
    status,
    json: async () => ({}),
    body: {
      getReader: () => ({
        read: async () => {
          if (i < chunks.length) {
            const value = encoder.encode(chunks[i]);
            i += 1;
            return { done: false, value };
          }
          return { done: true, value: undefined };
        },
      }),
    },
  };
}

describe('useSummarize', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useSummarize());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns a mapped summary result on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        summary: 'A summary',
        generatedTitle: 'Title',
        keywords: ['a', 'b'],
        confidence: 0.9,
        cached: false,
        provider: 'openai',
        latencyMs: 120,
      }),
    });

    const { result } = renderHook(() => useSummarize());

    let out: Awaited<ReturnType<typeof result.current.summarize>>;
    await act(async () => {
      out = await result.current.summarize('note-1', { length: 'short' });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/notes/summarize',
      expect.objectContaining({ method: 'POST' })
    );
    expect(out!).toEqual({
      summary: 'A summary',
      generatedTitle: 'Title',
      keywords: ['a', 'b'],
      confidence: 0.9,
      cached: false,
      provider: 'openai',
      latencyMs: 120,
    });
    expect(result.current.error).toBeNull();
  });

  it('summarize sets error and toasts on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Boom' }),
    });

    const { result } = renderHook(() => useSummarize());

    let out: unknown;
    await act(async () => {
      out = await result.current.summarize('note-1');
    });

    expect(out).toBeNull();
    expect(result.current.error).toBe('Boom');
    expect(toastError).toHaveBeenCalledWith(
      'Summarization failed',
      expect.any(Object)
    );
  });

  it('summarize handles a network rejection with a fallback message', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useSummarize());

    await act(async () => {
      await result.current.summarize('note-1');
    });

    expect(result.current.error).toBe('offline');
  });

  it('summarizeStream accumulates chunks and invokes onChunk', async () => {
    const onChunk = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeStreamResponse([
        'data: {"chunk":"Hello "}\n\n',
        'data: {"chunk":"world"}\n\n',
        'data: {"done":true}\n\n',
      ])
    );

    const { result } = renderHook(() => useSummarize());

    let out: string | null = null;
    await act(async () => {
      out = await result.current.summarizeStream('note-1', { onChunk });
    });

    expect(out).toBe('Hello world');
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello ', 'Hello ');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'world', 'Hello world');
  });

  it('summarizeStream invokes onReasoning for reasoning deltas', async () => {
    const onReasoning = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeStreamResponse([
        'data: {"reasoning":"thinking..."}\n\n',
        'data: {"chunk":"answer"}\n\n',
      ])
    );

    const { result } = renderHook(() => useSummarize());

    await act(async () => {
      await result.current.summarizeStream('note-1', { onReasoning });
    });

    expect(onReasoning).toHaveBeenCalledWith('thinking...', 'thinking...');
  });

  it('summarizeStream throws on an embedded error event', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeStreamResponse(['data: {"error":"stream blew up"}\n\n'])
    );

    const { result } = renderHook(() => useSummarize());

    let out: string | null = 'x';
    await act(async () => {
      out = await result.current.summarizeStream('note-1');
    });

    expect(out).toBeNull();
    expect(result.current.error).toBe('stream blew up');
  });

  it('summarizeStream errors when the start response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'cannot start' }),
    });

    const { result } = renderHook(() => useSummarize());

    let out: string | null = 'x';
    await act(async () => {
      out = await result.current.summarizeStream('note-1');
    });

    expect(out).toBeNull();
    expect(result.current.error).toBe('cannot start');
  });

  it('summarizeStream errors when there is no response body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
      body: null,
    });

    const { result } = renderHook(() => useSummarize());

    await act(async () => {
      await result.current.summarizeStream('note-1');
    });

    expect(result.current.error).toBe('No response body');
  });

  it('summarizeStream surfaces malformed JSON as an error (re-thrown by the parser guard)', async () => {
    // The hook only swallows a parse error whose message is exactly
    // "Unexpected token"; real V8 SyntaxError messages never match that, so a
    // malformed line propagates and the stream resolves to null with an error.
    const onChunk = jest.fn();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      makeStreamResponse([
        'data: not-json\n\n',
        'data: {"chunk":"ok"}\n\n',
      ])
    );

    const { result } = renderHook(() => useSummarize());

    let out: string | null = 'x';
    await act(async () => {
      out = await result.current.summarizeStream('note-1', { onChunk });
    });

    expect(out).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('generateTitle returns the title on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: 'Generated Title' }),
    });

    const { result } = renderHook(() => useSummarize());

    let title: string | null = null;
    await act(async () => {
      title = await result.current.generateTitle('note-1');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/notes/summarize?noteId=note-1'
    );
    expect(title).toBe('Generated Title');
  });

  it('generateTitle sets error and returns null on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'no title' }),
    });

    const { result } = renderHook(() => useSummarize());

    let title: string | null = 'x';
    await act(async () => {
      title = await result.current.generateTitle('note-1');
    });

    expect(title).toBeNull();
    expect(result.current.error).toBe('no title');
  });
});

describe('useAutoTag', () => {
  beforeEach(() => jest.clearAllMocks());

  it('suggestTags returns a mapped result on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        suggestions: [{ name: 'tag1', slug: 'tag1', confidence: 0.8 }],
        appliedTags: [],
        provider: 'openai',
        latencyMs: 50,
      }),
    });

    const { result } = renderHook(() => useAutoTag());

    let out: Awaited<ReturnType<typeof result.current.suggestTags>>;
    await act(async () => {
      out = await result.current.suggestTags('note-1', { maxSuggestions: 5 });
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/notes/auto-tag',
      expect.objectContaining({ method: 'POST' })
    );
    expect(out!.provider).toBe('openai');
    expect(out!.suggestions).toHaveLength(1);
  });

  it('suggestTags errors on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'tag fail' }),
    });

    const { result } = renderHook(() => useAutoTag());

    let out: unknown;
    await act(async () => {
      out = await result.current.suggestTags('note-1');
    });

    expect(out).toBeNull();
    expect(result.current.error).toBe('tag fail');
    expect(toastError).toHaveBeenCalledWith(
      'Auto-tagging failed',
      expect.any(Object)
    );
  });

  it('suggestTags handles a network rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('net'));

    const { result } = renderHook(() => useAutoTag());

    await act(async () => {
      await result.current.suggestTags('note-1');
    });

    expect(result.current.error).toBe('net');
  });

  it('applyTags returns true and toasts on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applied: ['a', 'b'], created: ['b'] }),
    });

    const { result } = renderHook(() => useAutoTag());

    let ok = false;
    await act(async () => {
      ok = await result.current.applyTags('note-1', ['a', 'b']);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/notes/auto-tag',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(ok).toBe(true);
    expect(toastSuccess).toHaveBeenCalledWith(
      'Tags applied',
      expect.objectContaining({
        description: expect.stringContaining('created 1 new tag'),
      })
    );
  });

  it('applyTags omits the "created" suffix when nothing was created', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ applied: ['a'], created: [] }),
    });

    const { result } = renderHook(() => useAutoTag());

    await act(async () => {
      await result.current.applyTags('note-1', ['a']);
    });

    expect(toastSuccess).toHaveBeenCalledWith(
      'Tags applied',
      expect.objectContaining({
        description: 'Applied 1 tag(s)',
      })
    );
  });

  it('applyTags returns false and errors on a non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'apply fail' }),
    });

    const { result } = renderHook(() => useAutoTag());

    let ok = true;
    await act(async () => {
      ok = await result.current.applyTags('note-1', ['a']);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('apply fail');
    expect(toastError).toHaveBeenCalledWith(
      'Failed to apply tags',
      expect.any(Object)
    );
  });

  it('applyTags handles a network rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useAutoTag());

    let ok = true;
    await act(async () => {
      ok = await result.current.applyTags('note-1', ['a']);
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('boom');
  });
});

describe('useAIFeatures', () => {
  beforeEach(() => jest.clearAllMocks());

  it('composes the summarize and autoTag hooks', () => {
    const { result } = renderHook(() => useAIFeatures());
    expect(typeof result.current.summarize.summarize).toBe('function');
    expect(typeof result.current.summarize.summarizeStream).toBe('function');
    expect(typeof result.current.autoTag.suggestTags).toBe('function');
    expect(typeof result.current.autoTag.applyTags).toBe('function');
  });
});
