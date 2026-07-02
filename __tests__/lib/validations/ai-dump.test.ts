import {
  aiDumpTemplateSchema,
  aiDumpToneSchema,
  aiDumpTogglesSchema,
  aiDumpOptionsSchema,
  createAIDumpSchema,
  regenerateSectionSchema,
  finalizeNoteSchema,
  titleVariantSchema,
  tagWithConfidenceSchema,
  actionItemSchema,
  provenanceSchema,
  aiDumpResultSchema,
  titleTagsTldrSchema,
  actionsSchema,
  tagSuggestionsSchema,
  summaryStructuredSchema,
} from '@/lib/validations/ai-dump';

describe('ai-dump validations', () => {
  describe('aiDumpTemplateSchema', () => {
    it.each([
      'auto',
      'meeting',
      'research',
      'code',
      'code-review',
      'brainstorm',
      'lecture',
      'article',
    ])('accepts %s', (t) => {
      expect(aiDumpTemplateSchema.safeParse(t).success).toBe(true);
    });

    it('rejects an unknown template', () => {
      expect(aiDumpTemplateSchema.safeParse('novel').success).toBe(false);
    });
  });

  describe('aiDumpToneSchema', () => {
    it.each(['balanced', 'formal', 'casual', 'technical'])(
      'accepts %s',
      (tone) => {
        expect(aiDumpToneSchema.safeParse(tone).success).toBe(true);
      }
    );

    it('rejects an unknown tone', () => {
      expect(aiDumpToneSchema.safeParse('snarky').success).toBe(false);
    });
  });

  describe('aiDumpTogglesSchema', () => {
    it('applies all defaults (true) for empty input', () => {
      const result = aiDumpTogglesSchema.parse({});
      expect(result).toEqual({
        titles: true,
        tags: true,
        markdown: true,
        actions: true,
        preserveCode: true,
      });
    });

    it('respects explicit overrides', () => {
      const result = aiDumpTogglesSchema.parse({ titles: false, actions: false });
      expect(result.titles).toBe(false);
      expect(result.actions).toBe(false);
      expect(result.tags).toBe(true);
    });

    it('rejects a non-boolean toggle', () => {
      expect(aiDumpTogglesSchema.safeParse({ titles: 'yes' }).success).toBe(
        false
      );
    });
  });

  describe('aiDumpOptionsSchema', () => {
    it('fills defaults for empty input', () => {
      const result = aiDumpOptionsSchema.parse({});
      expect(result.template).toBe('auto');
      expect(result.tone).toBe('balanced');
      expect(result.temperature).toBe(0.2);
      expect(result.toggles.titles).toBe(true);
    });

    it('accepts temperature at bounds 0 and 1', () => {
      expect(aiDumpOptionsSchema.safeParse({ temperature: 0 }).success).toBe(
        true
      );
      expect(aiDumpOptionsSchema.safeParse({ temperature: 1 }).success).toBe(
        true
      );
    });

    it('rejects temperature below 0 or above 1', () => {
      expect(aiDumpOptionsSchema.safeParse({ temperature: -0.1 }).success).toBe(
        false
      );
      expect(aiDumpOptionsSchema.safeParse({ temperature: 1.1 }).success).toBe(
        false
      );
    });

    it('accepts a fully specified options object', () => {
      const result = aiDumpOptionsSchema.safeParse({
        template: 'meeting',
        tone: 'formal',
        temperature: 0.7,
        toggles: { titles: false },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createAIDumpSchema', () => {
    it('accepts content-only input and applies defaults', () => {
      const result = createAIDumpSchema.safeParse({ content: 'hello' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe('paste');
        expect(result.data.options.template).toBe('auto');
        expect(result.data.options.toggles.tags).toBe(true);
      }
    });

    it('accepts imageData-only input', () => {
      const result = createAIDumpSchema.safeParse({
        imageData: 'data:image/png;base64,abc',
      });
      expect(result.success).toBe(true);
    });

    it('accepts fileRefs-only input', () => {
      const result = createAIDumpSchema.safeParse({ fileRefs: ['f1', 'f2'] });
      expect(result.success).toBe(true);
    });

    it('rejects when none of content/imageData/fileRefs provided (refine)', () => {
      const result = createAIDumpSchema.safeParse({ source: 'paste' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Either content, imageData, or fileRefs'
        );
      }
    });

    it('rejects when only an empty fileRefs array is provided', () => {
      const result = createAIDumpSchema.safeParse({ fileRefs: [] });
      expect(result.success).toBe(false);
    });

    it('rejects empty-string content with nothing else', () => {
      // content is .min(1) optional; empty string fails min, leaving refine to also fail
      const result = createAIDumpSchema.safeParse({ content: '' });
      expect(result.success).toBe(false);
    });

    it.each(['webclipper', 'upload', 'clipboard', 'paste'])(
      'accepts source %s',
      (source) => {
        const result = createAIDumpSchema.safeParse({ content: 'x', source });
        expect(result.success).toBe(true);
      }
    );

    it('rejects an invalid source', () => {
      const result = createAIDumpSchema.safeParse({
        content: 'x',
        source: 'email',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional metadata with a valid datetime timestamp', () => {
      const result = createAIDumpSchema.safeParse({
        content: 'x',
        metadata: {
          originalFilename: 'notes.txt',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects metadata with a non-datetime timestamp', () => {
      const result = createAIDumpSchema.safeParse({
        content: 'x',
        metadata: { timestamp: 'not-a-date' },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('regenerateSectionSchema', () => {
    it.each(['titles', 'tags', 'markdown', 'actions'])(
      'accepts section %s',
      (section) => {
        expect(
          regenerateSectionSchema.safeParse({ section }).success
        ).toBe(true);
      }
    );

    it('rejects an invalid section', () => {
      expect(
        regenerateSectionSchema.safeParse({ section: 'summary' }).success
      ).toBe(false);
    });

    it('rejects a missing section', () => {
      expect(regenerateSectionSchema.safeParse({}).success).toBe(false);
    });

    it('accepts an optional instruction within length', () => {
      expect(
        regenerateSectionSchema.safeParse({
          section: 'markdown',
          instruction: 'Make it shorter',
        }).success
      ).toBe(true);
    });

    it('rejects an instruction over 2000 chars', () => {
      expect(
        regenerateSectionSchema.safeParse({
          section: 'markdown',
          instruction: 'a'.repeat(2001),
        }).success
      ).toBe(false);
    });

    it('accepts optional options with temperature and tone', () => {
      expect(
        regenerateSectionSchema.safeParse({
          section: 'markdown',
          options: { temperature: 0.5, tone: 'casual' },
        }).success
      ).toBe(true);
    });

    it('rejects options with out-of-range temperature', () => {
      expect(
        regenerateSectionSchema.safeParse({
          section: 'markdown',
          options: { temperature: 2 },
        }).success
      ).toBe(false);
    });
  });

  describe('finalizeNoteSchema', () => {
    it('accepts a valid finalize payload and defaults retainRaw to true', () => {
      const result = finalizeNoteSchema.safeParse({
        selectedTitle: 'My Note',
        selectedTags: ['a', 'b'],
        finalMarkdown: '# Hello',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.retainRaw).toBe(true);
      }
    });

    it('respects an explicit retainRaw false', () => {
      const result = finalizeNoteSchema.safeParse({
        selectedTitle: 'My Note',
        selectedTags: [],
        finalMarkdown: '# Hello',
        retainRaw: false,
      });
      expect(result.success && result.data.retainRaw).toBe(false);
    });

    it('rejects an empty selectedTitle', () => {
      const result = finalizeNoteSchema.safeParse({
        selectedTitle: '',
        selectedTags: [],
        finalMarkdown: '# Hello',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Title is required');
      }
    });

    it('rejects empty finalMarkdown', () => {
      const result = finalizeNoteSchema.safeParse({
        selectedTitle: 'T',
        selectedTags: [],
        finalMarkdown: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects when selectedTags is not an array', () => {
      const result = finalizeNoteSchema.safeParse({
        selectedTitle: 'T',
        selectedTags: 'nope',
        finalMarkdown: '# H',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('response/output schemas', () => {
    it('titleVariantSchema accepts a valid variant', () => {
      expect(
        titleVariantSchema.safeParse({
          variant: 'short',
          text: 'Hi',
          score: 0.9,
        }).success
      ).toBe(true);
    });

    it('titleVariantSchema rejects out-of-range score and bad variant', () => {
      expect(
        titleVariantSchema.safeParse({
          variant: 'short',
          text: 'Hi',
          score: 1.5,
        }).success
      ).toBe(false);
      expect(
        titleVariantSchema.safeParse({
          variant: 'huge',
          text: 'Hi',
          score: 0.5,
        }).success
      ).toBe(false);
    });

    it('tagWithConfidenceSchema validates confidence bounds', () => {
      expect(
        tagWithConfidenceSchema.safeParse({ name: 'x', confidence: 0 }).success
      ).toBe(true);
      expect(
        tagWithConfidenceSchema.safeParse({ name: 'x', confidence: 1.2 }).success
      ).toBe(false);
    });

    it('actionItemSchema accepts a null due_date', () => {
      expect(
        actionItemSchema.safeParse({
          text: 'do it',
          assignee: 'me',
          due_date: null,
          confidence: 0.5,
        }).success
      ).toBe(true);
    });

    it('actionItemSchema rejects a missing assignee', () => {
      expect(
        actionItemSchema.safeParse({
          text: 'do it',
          due_date: null,
          confidence: 0.5,
        }).success
      ).toBe(false);
    });

    it('provenanceSchema requires a datetime generatedAt', () => {
      expect(
        provenanceSchema.safeParse({
          llm_model: 'm',
          prompt_template_id: 't',
          temperature: 0.2,
          generatedAt: '2024-01-01T00:00:00.000Z',
        }).success
      ).toBe(true);
      expect(
        provenanceSchema.safeParse({
          llm_model: 'm',
          prompt_template_id: 't',
          temperature: 0.2,
          generatedAt: 'yesterday',
        }).success
      ).toBe(false);
    });

    it('aiDumpResultSchema validates a full result object', () => {
      const result = aiDumpResultSchema.safeParse({
        titles: [{ variant: 'short', text: 'T', score: 1 }],
        tags: [{ name: 'a', confidence: 0.8 }],
        tldr: 'tldr',
        summary: 'summary',
        markdown: '# md',
        actions: [
          { text: 'a', assignee: 'b', due_date: null, confidence: 0.5 },
        ],
        provenance: {
          llm_model: 'm',
          prompt_template_id: 't',
          temperature: 0.2,
          generatedAt: '2024-01-01T00:00:00.000Z',
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('structured-output schemas', () => {
    it('titleTagsTldrSchema requires at least one title', () => {
      expect(
        titleTagsTldrSchema.safeParse({ titles: [], tags: [], tldr: '' })
          .success
      ).toBe(false);
      expect(
        titleTagsTldrSchema.safeParse({
          titles: [{ variant: 'short', text: 'T', score: 1 }],
          tags: [],
          tldr: 'x',
        }).success
      ).toBe(true);
    });

    it('actionsSchema accepts an empty actions array', () => {
      expect(actionsSchema.safeParse({ actions: [] }).success).toBe(true);
    });

    it('tagSuggestionsSchema applies defaults for confidence and reason', () => {
      const result = tagSuggestionsSchema.parse({
        suggestions: [{ name: 'work' }],
      });
      expect(result.suggestions[0].confidence).toBe(0.5);
      expect(result.suggestions[0].reason).toBe('AI suggested');
    });

    it('summaryStructuredSchema requires summary, allows optional fields', () => {
      expect(
        summaryStructuredSchema.safeParse({ summary: 's' }).success
      ).toBe(true);
      expect(
        summaryStructuredSchema.safeParse({
          summary: 's',
          title: 't',
          keywords: ['k'],
        }).success
      ).toBe(true);
      expect(summaryStructuredSchema.safeParse({}).success).toBe(false);
    });
  });
});
