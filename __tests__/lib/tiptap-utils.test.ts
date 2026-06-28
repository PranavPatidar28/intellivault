import {
  isMac,
  formatShortcutKey,
  parseShortcutKeys,
  isValidPosition,
  isAllowedUri,
  sanitizeUrl,
} from '@/lib/tiptap-utils';

describe('TipTap Utilities', () => {
  describe('isMac', () => {
    const originalPlatform = navigator.platform;

    afterEach(() => {
      // Restore original navigator
      Object.defineProperty(navigator, 'platform', {
        value: originalPlatform,
        writable: true,
      });
    });

    it('should return true for Mac platforms', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
      });
      expect(isMac()).toBe(true);
    });

    it('should return false for Windows platforms', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        writable: true,
      });
      expect(isMac()).toBe(false);
    });

    it('should return false for Linux platforms', () => {
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux',
        writable: true,
      });
      expect(isMac()).toBe(false);
    });
  });

  describe('formatShortcutKey', () => {
    it('should format cmd key for Mac', () => {
      const result = formatShortcutKey('cmd', true);
      expect(result).toBe('⌘');
    });

    it('should format ctrl key for Windows as Ctrl', () => {
      const result = formatShortcutKey('ctrl', false);
      expect(result).toBe('Ctrl');
    });

    it('should format ctrl key for Mac as Ctrl (fallback)', () => {
      const result = formatShortcutKey('ctrl', true);
      expect(result).toBe('⌃');
    });

    it('should format alt key for Mac', () => {
      const result = formatShortcutKey('alt', true);
      expect(result).toBe('⌥');
    });

    it('should format alt key for Windows', () => {
      const result = formatShortcutKey('alt', false);
      expect(result).toBe('Alt');
    });

    it('should capitalize non-special keys by default', () => {
      const result = formatShortcutKey('a', false, true);
      expect(result).toBe('A');
    });

    it('should not capitalize when capitalize is false', () => {
      const result = formatShortcutKey('a', false, false);
      expect(result).toBe('a');
    });
  });

  describe('parseShortcutKeys', () => {
    it('should parse shortcut keys with default delimiter', () => {
      const result = parseShortcutKeys({
        shortcutKeys: 'ctrl-shift-a',
      });
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined shortcut keys', () => {
      const result = parseShortcutKeys({
        shortcutKeys: undefined,
      });
      expect(result).toEqual([]);
    });

    it('should parse with custom delimiter', () => {
      const result = parseShortcutKeys({
        shortcutKeys: 'ctrl+shift+a',
        delimiter: '+',
      });
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle capitalize option', () => {
      const resultCaps = parseShortcutKeys({
        shortcutKeys: 'a',
        capitalize: true,
      });
      const resultNoCaps = parseShortcutKeys({
        shortcutKeys: 'a',
        capitalize: false,
      });
      expect(resultCaps).not.toEqual(resultNoCaps);
    });
  });

  describe('isValidPosition', () => {
    it('should return true for positive numbers', () => {
      expect(isValidPosition(0)).toBe(true);
      expect(isValidPosition(1)).toBe(true);
      expect(isValidPosition(100)).toBe(true);
    });

    it('should return false for negative numbers', () => {
      // ProseMirror positions are always >= 0
      expect(isValidPosition(-1)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isValidPosition(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidPosition(undefined)).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(isValidPosition(NaN)).toBe(false);
    });
  });

  describe('isAllowedUri', () => {
    it('should allow http URLs', () => {
      expect(isAllowedUri('http://example.com')).toBe(true);
    });

    it('should allow https URLs', () => {
      expect(isAllowedUri('https://example.com')).toBe(true);
    });

    it('should allow mailto links', () => {
      expect(isAllowedUri('mailto:test@example.com')).toBe(true);
    });

    it('should allow tel links', () => {
      expect(isAllowedUri('tel:1234567890')).toBe(true);
    });

    it('should reject javascript: protocol (XSS)', () => {
      expect(isAllowedUri('javascript:alert(1)')).toBe(false);
    });

    it('should reject data: URIs by default', () => {
      expect(isAllowedUri('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should handle undefined URI', () => {
      // No URI means no dangerous protocol -> allowed (matches upstream TipTap)
      expect(isAllowedUri(undefined)).toBe(true);
    });

    it('should handle empty string', () => {
      expect(isAllowedUri('')).toBe(true);
    });

    it('should be case insensitive for protocols', () => {
      expect(isAllowedUri('HTTP://example.com')).toBe(true);
      expect(isAllowedUri('HTTPS://example.com')).toBe(true);
    });
  });

  describe('sanitizeUrl', () => {
    it('should allow safe http URLs', () => {
      const result = sanitizeUrl('http://example.com', 'http://base.com');
      // new URL() normalizes with a trailing slash
      expect(result).toBe('http://example.com/');
    });

    it('should allow safe https URLs', () => {
      const result = sanitizeUrl('https://example.com', 'https://base.com');
      expect(result).toBe('https://example.com/');
    });

    it('should block javascript: protocol', () => {
      const result = sanitizeUrl('javascript:alert(1)', 'http://base.com');
      expect(result).not.toContain('javascript:');
    });

    it('should handle relative URLs', () => {
      const result = sanitizeUrl('/path/to/page', 'http://example.com');
      expect(result).toContain('/path/to/page');
    });

    it('should handle empty input', () => {
      const result = sanitizeUrl('', 'http://example.com');
      expect(result).toBeDefined();
    });

    it('should strip dangerous whitespace in protocols', () => {
      const result = sanitizeUrl('java script:alert(1)', 'http://base.com');
      expect(result).not.toContain('javascript:');
    });
  });
});
