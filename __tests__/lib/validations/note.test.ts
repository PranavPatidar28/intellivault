import {
  createNoteSchema,
  updateNoteSchema,
  noteQuerySchema,
} from '@/lib/validations/note';

describe('Note Validation Schemas', () => {
  describe('createNoteSchema', () => {
    it('should validate a valid note with all required fields', () => {
      const validNote = {
        title: 'Test Note',
        contentJSON: { type: 'doc', content: [] },
        contentText: 'Test content',
        tags: ['tag1', 'tag2'],
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should validate with only required title field', () => {
      const minimalNote = {
        title: 'Test Note',
      };

      const result = createNoteSchema.safeParse(minimalNote);
      expect(result.success).toBe(true);
    });

    it('should reject empty title', () => {
      const invalidNote = {
        title: '',
      };

      const result = createNoteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Title is required');
      }
    });

    it('should reject title that is too long', () => {
      const invalidNote = {
        title: 'a'.repeat(101), // 101 characters
      };

      const result = createNoteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('too long');
      }
    });

    it('should accept title at maximum length', () => {
      const validNote = {
        title: 'a'.repeat(100), // Exactly 100 characters
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should reject note without title', () => {
      const invalidNote = {
        contentText: 'Some content',
      };

      const result = createNoteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
    });

    it('should accept complex contentJSON', () => {
      const validNote = {
        title: 'Test Note',
        contentJSON: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello' }],
            },
          ],
        },
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should accept empty tags array', () => {
      const validNote = {
        title: 'Test Note',
        tags: [],
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });

    it('should reject invalid tags (not an array)', () => {
      const invalidNote = {
        title: 'Test Note',
        tags: 'not-an-array',
      };

      const result = createNoteSchema.safeParse(invalidNote);
      expect(result.success).toBe(false);
    });

    it('should handle special characters in title', () => {
      const validNote = {
        title: 'Test Note! @#$%^&*() 123',
      };

      const result = createNoteSchema.safeParse(validNote);
      expect(result.success).toBe(true);
    });
  });

  describe('updateNoteSchema', () => {
    it('should validate with all fields', () => {
      const validUpdate = {
        title: 'Updated Title',
        contentJSON: { type: 'doc', content: [] },
        contentText: 'Updated content',
        tags: ['tag1'],
      };

      const result = updateNoteSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate with only title', () => {
      const partialUpdate = {
        title: 'Updated Title',
      };

      const result = updateNoteSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate with only contentJSON', () => {
      const partialUpdate = {
        contentJSON: { type: 'doc', content: [] },
      };

      const result = updateNoteSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate with only tags', () => {
      const partialUpdate = {
        tags: ['tag1', 'tag2'],
      };

      const result = updateNoteSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate empty object (no updates)', () => {
      const emptyUpdate = {};

      const result = updateNoteSchema.safeParse(emptyUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject empty title if provided', () => {
      const invalidUpdate = {
        title: '',
      };

      const result = updateNoteSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should reject title that is too long if provided', () => {
      const invalidUpdate = {
        title: 'a'.repeat(101),
      };

      const result = updateNoteSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should accept title at maximum length', () => {
      const validUpdate = {
        title: 'a'.repeat(100),
      };

      const result = updateNoteSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });
  });

  describe('noteQuerySchema', () => {
    it('should use default values when no params provided', () => {
      const result = noteQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should parse valid page and limit', () => {
      const params = {
        page: 2,
        limit: 20,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should coerce string numbers to integers', () => {
      const params = {
        page: '3',
        limit: '15',
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(15);
      }
    });

    it('should reject negative page number', () => {
      const params = {
        page: -1,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject zero page number', () => {
      const params = {
        page: 0,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject negative limit', () => {
      const params = {
        limit: -5,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject limit over 100', () => {
      const params = {
        limit: 101,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should accept limit exactly at 100', () => {
      const params = {
        limit: 100,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
      }
    });

    it('should reject non-integer page', () => {
      const params = {
        page: 1.5,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer limit', () => {
      const params = {
        limit: 10.5,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should handle large valid numbers', () => {
      const params = {
        page: 999999,
        limit: 50,
      };

      const result = noteQuerySchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });
});
