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

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAIDump } from '@/hooks/use-ai-dump';

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
 * Build a streaming Response whose body yields the given SSE text chunks. Each
 * string is delivered as one reader.read() result, then `done`.
 */
function makeStreamResponse(chunks: string[], ok = true) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    ok,
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

function sse(type: string, data: unknown) {
  return `data: ${JSON.stringify({ type, data })}\n\n`;
}

describe('useAIDump', () => {
  beforeEach(() => jest.clearAllMocks());

  it('initializes with empty state', () => {
    const { result } = renderHook(() => useAIDump());
    expect(result.current.aiDump).toBeNull();
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedTitle).toBe('');
    expect(result.current.selectedTags).toEqual([]);
    expect(result.current.isRegenerating).toEqual({
      titles: false,
      tags: false,
      markdown: false,
      actions: false,
    });
  });

  describe('createAIDump', () => {
    it('processes a full stream and assembles the dump', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('status', 'Working...'),
          sse('note_created', { noteId: 'note-99' }),
          sse('titles', [
            { variant: 'short', text: 'Short Title' },
            { variant: 'long', text: 'A Much Longer Title' },
          ]),
          sse('tags', [
            { name: 'ai', confidence: 0.9 },
            { name: 'notes', confidence: 0.8 },
          ]),
          sse('tldr', 'A tldr'),
          sse('markdown_chunk', '# Hello'),
          sse('markdown_chunk', '\nworld'),
          sse('summary_chunk', 'Sum'),
          sse('actions', [{ text: 'Do thing' }]),
          sse('reasoning', 'because'),
          sse('done', null),
        ])
      );

      const { result } = renderHook(() => useAIDump());

      let ok = false;
      await act(async () => {
        ok = await result.current.createAIDump('raw content');
      });

      expect(ok).toBe(true);
      expect(result.current.aiDump).toMatchObject({
        noteId: 'note-99',
        tldr: 'A tldr',
        markdown: '# Hello\nworld',
        summary: 'Sum',
        rawText: 'raw content',
        status: 'draft',
        reasoning: 'because',
      });
      expect(result.current.aiDump?.titles).toHaveLength(2);
      // Default selected title prefers the "short" variant.
      expect(result.current.selectedTitle).toBe('Short Title');
      expect(result.current.selectedTags).toEqual(['ai', 'notes']);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
      expect(toastSuccess).toHaveBeenCalledWith(
        'AI Dump Complete',
        expect.any(Object)
      );
    });

    it('posts to the stream endpoint with merged options and source', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([sse('done', null)])
      );

      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text', { tone: 'formal' }, {
          source: 'upload',
          imageData: 'data:image/png;base64,xxx',
        });
      });

      const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('/api/ai-dump/stream');
      const body = JSON.parse(init.body);
      expect(body.content).toBe('text');
      expect(body.source).toBe('upload');
      expect(body.imageData).toBe('data:image/png;base64,xxx');
      expect(body.options.tone).toBe('formal');
      // Default toggles preserved from DEFAULT_OPTIONS.
      expect(body.options.template).toBe('auto');
    });

    it('sets warning on a warning event', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('warning', 'Content was truncated'),
          sse('done', null),
        ])
      );

      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      expect(result.current.warning).toBe('Content was truncated');
    });

    it('fails when the initial response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Bad request' }),
      });

      const { result } = renderHook(() => useAIDump());
      let ok = true;
      await act(async () => {
        ok = await result.current.createAIDump('text');
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe('Bad request');
      expect(toastError).toHaveBeenCalledWith(
        'Processing Failed',
        expect.any(Object)
      );
    });

    it('fails on an error event mid-stream', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([sse('error', 'model exploded')])
      );

      const { result } = renderHook(() => useAIDump());
      let ok = true;
      await act(async () => {
        ok = await result.current.createAIDump('text');
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe('model exploded');
    });

    it('skips malformed JSON lines in the stream', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          'data: {bad json\n\n',
          sse('tldr', 'fine'),
          sse('done', null),
        ])
      );

      const { result } = renderHook(() => useAIDump());
      let ok = false;
      await act(async () => {
        ok = await result.current.createAIDump('text');
      });

      expect(ok).toBe(true);
      expect(result.current.aiDump?.tldr).toBe('fine');
    });

    it('errors when there is no response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        body: null,
      });

      const { result } = renderHook(() => useAIDump());
      let ok = true;
      await act(async () => {
        ok = await result.current.createAIDump('text');
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe('No response body');
    });

    it('treats an AbortError as a quiet stop (returns false, no error set)', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() => {
        const err = new DOMException('Aborted', 'AbortError');
        return Promise.reject(err);
      });

      const { result } = renderHook(() => useAIDump());
      let ok = true;
      await act(async () => {
        ok = await result.current.createAIDump('text');
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBeNull();
      expect(toastError).not.toHaveBeenCalled();
    });
  });

  describe('regenerateSection', () => {
    it('returns false when there is no current dump', async () => {
      const { result } = renderHook(() => useAIDump());
      let ok = true;
      await act(async () => {
        ok = await result.current.regenerateSection('titles');
      });
      expect(ok).toBe(false);
      expect(result.current.error).toBe('No AI Dump to regenerate');
    });

    it('returns false when the dump has no server noteId', async () => {
      // First create a dump WITHOUT a note_created event so noteId stays "".
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([sse('tldr', 'x'), sse('done', null)])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      let ok = true;
      await act(async () => {
        ok = await result.current.regenerateSection('titles');
      });
      expect(ok).toBe(false);
      expect(result.current.error).toContain("wasn't saved on the server");
    });

    it('regenerates a section and updates state', async () => {
      // Create with a noteId.
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('note_created', { noteId: 'n1' }),
          sse('titles', [{ variant: 'short', text: 'Old' }]),
          sse('done', null),
        ])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      // Regenerate titles.
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          updatedSection: {
            titles: [{ variant: 'short', text: 'New Title' }],
          },
        }),
      });

      let ok = false;
      await act(async () => {
        ok = await result.current.regenerateSection('titles', {
          temperature: 0.5,
        });
      });

      expect(ok).toBe(true);
      expect(result.current.aiDump?.titles[0].text).toBe('New Title');
      const lastCall = (global.fetch as jest.Mock).mock.calls.at(-1)!;
      expect(lastCall[0]).toBe('/api/ai-dump/n1/regenerate');
      expect(toastSuccess).toHaveBeenCalledWith(
        'Section Regenerated',
        expect.any(Object)
      );
    });

    it('resets selected tags only when the tags section is regenerated', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('note_created', { noteId: 'n1' }),
          sse('tags', [{ name: 'old', confidence: 1 }]),
          sse('done', null),
        ])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });
      expect(result.current.selectedTags).toEqual(['old']);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          updatedSection: { tags: [{ name: 'new', confidence: 1 }] },
        }),
      });

      await act(async () => {
        await result.current.regenerateSection('tags');
      });

      expect(result.current.selectedTags).toEqual(['new']);
    });

    it('errors when regenerate response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('note_created', { noteId: 'n1' }),
          sse('done', null),
        ])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'regen failed' }),
      });

      let ok = true;
      await act(async () => {
        ok = await result.current.regenerateSection('markdown');
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe('regen failed');
      expect(toastError).toHaveBeenCalledWith(
        'Regeneration Failed',
        expect.any(Object)
      );
    });
  });

  describe('finalize', () => {
    it('returns null when there is no dump', async () => {
      const { result } = renderHook(() => useAIDump());
      let out: string | null = 'x';
      await act(async () => {
        out = await result.current.finalize();
      });
      expect(out).toBeNull();
      expect(result.current.error).toBe('No AI Dump to finalize');
    });

    it('returns null when the dump has no server noteId', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([sse('tldr', 'x'), sse('done', null)])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      let out: string | null = 'x';
      await act(async () => {
        out = await result.current.finalize();
      });
      expect(out).toBeNull();
      expect(result.current.error).toContain("wasn't saved on the server");
    });

    it('finalizes and returns the saved note id', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('note_created', { noteId: 'n1' }),
          sse('markdown_end', '# Final'),
          sse('done', null),
        ])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ noteId: 'saved-1' }),
      });

      let out: string | null = null;
      await act(async () => {
        out = await result.current.finalize({ selectedTitle: 'My Title' });
      });

      expect(out).toBe('saved-1');
      expect(result.current.aiDump?.status).toBe('final');
      const lastCall = (global.fetch as jest.Mock).mock.calls.at(-1)!;
      expect(lastCall[0]).toBe('/api/ai-dump/n1/finalize');
      const body = JSON.parse(lastCall[1].body);
      expect(body.selectedTitle).toBe('My Title');
      expect(body.retainRaw).toBe(true);
    });

    it('errors when finalize response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('note_created', { noteId: 'n1' }),
          sse('done', null),
        ])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'save failed' }),
      });

      let out: string | null = 'x';
      await act(async () => {
        out = await result.current.finalize();
      });

      expect(out).toBeNull();
      expect(result.current.error).toBe('save failed');
      expect(toastError).toHaveBeenCalledWith('Save Failed', expect.any(Object));
    });
  });

  describe('loadDraft', () => {
    it('loads a draft and restores selections', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          note: {
            id: 'd1',
            title: 'Saved Title',
            titles: [
              { variant: 'short', text: 'Short' },
              { variant: 'long', text: 'Long' },
            ],
            tags: [{ name: 'work' }, { name: 'ideas' }],
            tldr: 'tl',
            summary: 'sum',
            generatedMd: '# md',
            actions: [],
            rawText: 'raw',
            status: 'DRAFT',
          },
        }),
      });

      const { result } = renderHook(() => useAIDump());
      let ok = false;
      await act(async () => {
        ok = await result.current.loadDraft('d1');
      });

      expect(ok).toBe(true);
      expect(result.current.aiDump).toMatchObject({
        noteId: 'd1',
        tldr: 'tl',
        summary: 'sum',
        markdown: '# md',
        rawText: 'raw',
        status: 'draft',
      });
      expect(result.current.selectedTitle).toBe('Saved Title');
      expect(result.current.selectedTags).toEqual(['work', 'ideas']);
    });

    it('maps a FINAL status to final', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          note: { id: 'd2', status: 'FINAL', titles: [], tags: [] },
        }),
      });

      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.loadDraft('d2');
      });

      expect(result.current.aiDump?.status).toBe('final');
    });

    it('errors when the draft response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'not found' }),
      });

      const { result } = renderHook(() => useAIDump());
      let ok = true;
      await act(async () => {
        ok = await result.current.loadDraft('missing');
      });

      expect(ok).toBe(false);
      expect(result.current.error).toBe('not found');
    });
  });

  describe('deleteDraft', () => {
    it('deletes a draft and clears state when it matches the current dump', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('note_created', { noteId: 'n1' }),
          sse('done', null),
        ])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      let ok = false;
      await act(async () => {
        ok = await result.current.deleteDraft('n1');
      });

      expect(ok).toBe(true);
      expect(result.current.aiDump).toBeNull();
      expect(toastSuccess).toHaveBeenCalledWith(
        'Draft Deleted',
        expect.any(Object)
      );
    });

    it('errors when delete response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'cannot delete' }),
      });

      const { result } = renderHook(() => useAIDump());
      let ok = true;
      await act(async () => {
        ok = await result.current.deleteDraft('x');
      });

      expect(ok).toBe(false);
      expect(toastError).toHaveBeenCalledWith(
        'Delete Failed',
        expect.any(Object)
      );
    });
  });

  describe('listDrafts', () => {
    it('returns the notes array on success', async () => {
      const notes = [{ id: '1', title: 'A', tldr: null, source: null, createdAt: '', updatedAt: '' }];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notes }),
      });

      const { result } = renderHook(() => useAIDump());
      let out: unknown[] = [];
      await act(async () => {
        out = await result.current.listDrafts();
      });

      expect(out).toEqual(notes);
      expect(global.fetch).toHaveBeenCalledWith('/api/ai-dump?limit=20');
    });

    it('returns an empty array on a non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'nope' }),
      });

      const { result } = renderHook(() => useAIDump());
      let out: unknown[] = [{ id: 'x' }];
      await act(async () => {
        out = await result.current.listDrafts();
      });

      expect(out).toEqual([]);
    });

    it('returns an empty array on a network rejection', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('net'));
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAIDump());
      let out: unknown[] = [{ id: 'x' }];
      await act(async () => {
        out = await result.current.listDrafts();
      });

      expect(out).toEqual([]);
      spy.mockRestore();
    });
  });

  describe('selection handlers', () => {
    it('setSelectedTitle updates the title', () => {
      const { result } = renderHook(() => useAIDump());
      act(() => result.current.setSelectedTitle('New'));
      expect(result.current.selectedTitle).toBe('New');
    });

    it('toggleTag adds and removes a tag', () => {
      const { result } = renderHook(() => useAIDump());
      act(() => result.current.toggleTag('x'));
      expect(result.current.selectedTags).toEqual(['x']);
      act(() => result.current.toggleTag('x'));
      expect(result.current.selectedTags).toEqual([]);
    });

    it('setSelectedTags replaces the selection', () => {
      const { result } = renderHook(() => useAIDump());
      act(() => result.current.setSelectedTags(['a', 'b']));
      expect(result.current.selectedTags).toEqual(['a', 'b']);
    });
  });

  describe('reset and cancel', () => {
    it('reset clears all state', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        makeStreamResponse([
          sse('note_created', { noteId: 'n1' }),
          sse('tldr', 'x'),
          sse('done', null),
        ])
      );
      const { result } = renderHook(() => useAIDump());
      await act(async () => {
        await result.current.createAIDump('text');
      });
      expect(result.current.aiDump).not.toBeNull();

      act(() => result.current.reset());

      expect(result.current.aiDump).toBeNull();
      expect(result.current.selectedTitle).toBe('');
      expect(result.current.selectedTags).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.warning).toBeNull();
    });

    it('cancel does not throw when there is no in-flight stream', () => {
      const { result } = renderHook(() => useAIDump());
      expect(() => act(() => result.current.cancel())).not.toThrow();
    });
  });

  it('aborts in-flight requests on unmount without throwing', async () => {
    // Never-resolving stream keeps a request in flight at unmount.
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {})
    );
    const { result, unmount } = renderHook(() => useAIDump());
    act(() => {
      void result.current.createAIDump('text');
    });
    await waitFor(() => expect(result.current.isProcessing).toBe(true));
    expect(() => unmount()).not.toThrow();
  });
});
