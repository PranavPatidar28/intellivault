import { getRelativeTime, truncateText, slugify } from '@/lib/utils/text';

describe('Text Utilities', () => {
  describe('getRelativeTime', () => {
    beforeEach(() => {
      // Mock the current date to have consistent tests
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return "just now" for times less than 60 seconds ago', () => {
      const date = new Date('2024-01-15T11:59:30Z'); // 30 seconds ago
      expect(getRelativeTime(date)).toBe('just now');
    });

    it('should return minutes for times less than an hour ago', () => {
      const date = new Date('2024-01-15T11:55:00Z'); // 5 minutes ago
      expect(getRelativeTime(date)).toBe('5 minutes ago');
    });

    it('should return singular minute correctly', () => {
      const date = new Date('2024-01-15T11:59:00Z'); // 1 minute ago
      expect(getRelativeTime(date)).toBe('1 minute ago');
    });

    it('should return hours for times less than a day ago', () => {
      const date = new Date('2024-01-15T09:00:00Z'); // 3 hours ago
      expect(getRelativeTime(date)).toBe('3 hours ago');
    });

    it('should return singular hour correctly', () => {
      const date = new Date('2024-01-15T11:00:00Z'); // 1 hour ago
      expect(getRelativeTime(date)).toBe('1 hour ago');
    });

    it('should return days for times less than 30 days ago', () => {
      const date = new Date('2024-01-10T12:00:00Z'); // 5 days ago
      expect(getRelativeTime(date)).toBe('5 days ago');
    });

    it('should return singular day correctly', () => {
      const date = new Date('2024-01-14T12:00:00Z'); // 1 day ago
      expect(getRelativeTime(date)).toBe('1 day ago');
    });

    it('should return months for times less than a year ago', () => {
      const date = new Date('2023-11-15T12:00:00Z'); // 2 months ago
      expect(getRelativeTime(date)).toBe('2 months ago');
    });

    it('should return singular month correctly', () => {
      const date = new Date('2023-12-14T12:00:00Z'); // ~1 month ago
      expect(getRelativeTime(date)).toBe('1 month ago');
    });

    it('should return years for times more than a year ago', () => {
      const date = new Date('2022-01-15T12:00:00Z'); // 2 years ago
      expect(getRelativeTime(date)).toBe('2 years ago');
    });

    it('should return singular year correctly', () => {
      const date = new Date('2023-01-14T12:00:00Z'); // ~1 year ago
      expect(getRelativeTime(date)).toBe('1 year ago');
    });

    it('should handle date strings', () => {
      const dateString = '2024-01-15T11:55:00Z';
      expect(getRelativeTime(dateString)).toBe('5 minutes ago');
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = 'invalid-date';
      // Should not throw, but return NaN-based result
      expect(() => getRelativeTime(invalidDate)).not.toThrow();
    });
  });

  describe('truncateText', () => {
    it('should not truncate text shorter than max length', () => {
      const text = 'Short text';
      expect(truncateText(text, 50)).toBe('Short text');
    });

    it('should truncate text longer than max length', () => {
      const text = 'This is a very long text that should be truncated';
      const result = truncateText(text, 20);
      expect(result).toBe('This is a very long...');
      expect(result.length).toBe(23); // 20 chars + "..."
    });

    it('should use default max length of 150', () => {
      const text = 'a'.repeat(200);
      const result = truncateText(text);
      expect(result.length).toBe(153); // 150 + "..."
    });

    it('should handle exact length correctly', () => {
      const text = 'Exactly twenty chars';
      expect(truncateText(text, 20)).toBe('Exactly twenty chars');
    });

    it('should handle empty strings', () => {
      expect(truncateText('', 50)).toBe('');
    });

    it('should trim whitespace before adding ellipsis', () => {
      const text = 'This is text with spaces     at the end that will be cut';
      const result = truncateText(text, 25);
      expect(result).toBe('This is text with spaces...');
    });

    it('should handle special characters', () => {
      const text = 'Text with émojis 🎉🎊 and spëcial çhars!';
      const result = truncateText(text, 20);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(23);
    });
  });

  describe('slugify', () => {
    it('should convert text to lowercase', () => {
      expect(slugify('UPPERCASE TEXT')).toBe('uppercase-text');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('hello world')).toBe('hello-world');
    });

    it('should replace multiple spaces with single hyphen', () => {
      expect(slugify('hello    world')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('hello@#$%world')).toBe('helloworld');
    });

    it('should handle text with mixed special chars and spaces', () => {
      expect(slugify('Hello, World! This is a test.')).toBe('hello-world-this-is-a-test');
    });

    it('should trim hyphens from start and end', () => {
      expect(slugify('  hello world  ')).toBe('hello-world');
    });

    it('should handle unicode characters', () => {
      expect(slugify('café résumé')).toBe('caf-rsum');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle strings with only special characters', () => {
      expect(slugify('@#$%^&*()')).toBe('');
    });

    it('should handle dashes in the middle', () => {
      expect(slugify('hello-world')).toBe('hello-world');
    });

    it('should consolidate multiple hyphens', () => {
      expect(slugify('hello---world')).toBe('hello-world');
    });

    it('should handle numbers', () => {
      expect(slugify('Tag 123')).toBe('tag-123');
    });

    it('should handle underscores (keep them)', () => {
      expect(slugify('hello_world')).toBe('hello_world');
    });
  });
});
