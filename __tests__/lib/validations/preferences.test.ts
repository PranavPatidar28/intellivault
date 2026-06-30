import { updatePreferencesSchema } from '@/lib/validations/preferences';

describe('updatePreferencesSchema', () => {
  describe('partial / empty updates', () => {
    it('accepts an empty object (all fields optional)', () => {
      const result = updatePreferencesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts a single-field update', () => {
      const result = updatePreferencesSchema.safeParse({ theme: 'dark' });
      expect(result.success).toBe(true);
    });
  });

  describe('strict mode', () => {
    it('rejects unknown keys (mass-assignment guard)', () => {
      const result = updatePreferencesSchema.safeParse({
        theme: 'dark',
        userId: 'hacker',
      });
      expect(result.success).toBe(false);
    });

    it('rejects id/createdAt style server-controlled columns', () => {
      expect(
        updatePreferencesSchema.safeParse({ id: 'x' }).success
      ).toBe(false);
      expect(
        updatePreferencesSchema.safeParse({ createdAt: 'now' }).success
      ).toBe(false);
    });
  });

  describe('appearance enums', () => {
    it.each(['light', 'dark', 'system'])('accepts theme %s', (theme) => {
      expect(updatePreferencesSchema.safeParse({ theme }).success).toBe(true);
    });

    it('rejects an invalid theme', () => {
      expect(
        updatePreferencesSchema.safeParse({ theme: 'neon' }).success
      ).toBe(false);
    });

    it.each(['small', 'medium', 'large'])('accepts fontSize %s', (fontSize) => {
      expect(updatePreferencesSchema.safeParse({ fontSize }).success).toBe(true);
    });

    it('rejects an invalid fontSize', () => {
      expect(
        updatePreferencesSchema.safeParse({ fontSize: 'huge' }).success
      ).toBe(false);
    });

    it.each(['compact', 'comfortable', 'spacious'])(
      'accepts displayDensity %s',
      (displayDensity) => {
        expect(
          updatePreferencesSchema.safeParse({ displayDensity }).success
        ).toBe(true);
      }
    );

    it('rejects an invalid displayDensity', () => {
      expect(
        updatePreferencesSchema.safeParse({ displayDensity: 'tight' }).success
      ).toBe(false);
    });
  });

  describe('AI settings', () => {
    it.each(['ollama', 'gemini', 'openai', 'openrouter', 'nvidia'])(
      'accepts defaultLLMProvider %s',
      (defaultLLMProvider) => {
        expect(
          updatePreferencesSchema.safeParse({ defaultLLMProvider }).success
        ).toBe(true);
      }
    );

    it('accepts null defaultLLMProvider', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultLLMProvider: null }).success
      ).toBe(true);
    });

    it('rejects an unknown defaultLLMProvider', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultLLMProvider: 'anthropic' })
          .success
      ).toBe(false);
    });

    it('accepts a defaultLLMModel string and null', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultLLMModel: 'gpt-4o' }).success
      ).toBe(true);
      expect(
        updatePreferencesSchema.safeParse({ defaultLLMModel: null }).success
      ).toBe(true);
    });

    it('rejects a defaultLLMModel over 100 chars', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultLLMModel: 'a'.repeat(101) })
          .success
      ).toBe(false);
    });

    it('accepts boolean aiAutoSummarize / aiAutoTag', () => {
      expect(
        updatePreferencesSchema.safeParse({
          aiAutoSummarize: true,
          aiAutoTag: false,
        }).success
      ).toBe(true);
    });

    it('rejects non-boolean aiAutoSummarize', () => {
      expect(
        updatePreferencesSchema.safeParse({ aiAutoSummarize: 'yes' }).success
      ).toBe(false);
    });
  });

  describe('notes & editor', () => {
    it.each(['grid', 'list'])('accepts defaultNoteView %s', (defaultNoteView) => {
      expect(
        updatePreferencesSchema.safeParse({ defaultNoteView }).success
      ).toBe(true);
    });

    it('rejects invalid defaultNoteView', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultNoteView: 'kanban' }).success
      ).toBe(false);
    });

    it.each(['updatedAt', 'createdAt', 'title', 'title-desc'])(
      'accepts defaultSortOrder %s',
      (defaultSortOrder) => {
        expect(
          updatePreferencesSchema.safeParse({ defaultSortOrder }).success
        ).toBe(true);
      }
    );

    it('rejects invalid defaultSortOrder', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultSortOrder: 'random' }).success
      ).toBe(false);
    });

    describe('autoSaveInterval', () => {
      it('accepts 0 (min) and 3600 (max)', () => {
        expect(
          updatePreferencesSchema.safeParse({ autoSaveInterval: 0 }).success
        ).toBe(true);
        expect(
          updatePreferencesSchema.safeParse({ autoSaveInterval: 3600 }).success
        ).toBe(true);
      });

      it('rejects negative values', () => {
        expect(
          updatePreferencesSchema.safeParse({ autoSaveInterval: -1 }).success
        ).toBe(false);
      });

      it('rejects values over 3600', () => {
        expect(
          updatePreferencesSchema.safeParse({ autoSaveInterval: 3601 }).success
        ).toBe(false);
      });

      it('rejects non-integers', () => {
        expect(
          updatePreferencesSchema.safeParse({ autoSaveInterval: 1.5 }).success
        ).toBe(false);
      });
    });

    it('accepts boolean showWordCount / spellCheck', () => {
      expect(
        updatePreferencesSchema.safeParse({
          showWordCount: true,
          spellCheck: false,
        }).success
      ).toBe(true);
    });
  });

  describe('tags', () => {
    it('accepts a 3-digit hex color without #', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultTagColor: 'fff' }).success
      ).toBe(true);
    });

    it('accepts a 6-digit hex color with #', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultTagColor: '#1a2b3c' }).success
      ).toBe(true);
    });

    it('accepts null defaultTagColor', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultTagColor: null }).success
      ).toBe(true);
    });

    it('rejects an invalid hex color', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultTagColor: 'zzz' }).success
      ).toBe(false);
    });

    it('rejects a malformed-length hex color', () => {
      expect(
        updatePreferencesSchema.safeParse({ defaultTagColor: '#12345' }).success
      ).toBe(false);
    });

    it('accepts boolean enableTagSuggestions', () => {
      expect(
        updatePreferencesSchema.safeParse({ enableTagSuggestions: true }).success
      ).toBe(true);
    });
  });

  describe('privacy', () => {
    it('accepts boolean analyticsEnabled', () => {
      expect(
        updatePreferencesSchema.safeParse({ analyticsEnabled: false }).success
      ).toBe(true);
    });

    it('rejects non-boolean analyticsEnabled', () => {
      expect(
        updatePreferencesSchema.safeParse({ analyticsEnabled: 1 }).success
      ).toBe(false);
    });
  });

  it('accepts a full valid payload across all sections', () => {
    const full = {
      theme: 'system',
      fontSize: 'medium',
      displayDensity: 'comfortable',
      defaultLLMProvider: 'openai',
      defaultLLMModel: 'gpt-4o-mini',
      aiAutoSummarize: true,
      aiAutoTag: false,
      defaultNoteView: 'grid',
      defaultSortOrder: 'updatedAt',
      autoSaveInterval: 30,
      showWordCount: true,
      spellCheck: true,
      defaultTagColor: '#abcdef',
      enableTagSuggestions: true,
      analyticsEnabled: false,
    };
    const result = updatePreferencesSchema.safeParse(full);
    expect(result.success).toBe(true);
  });
});
