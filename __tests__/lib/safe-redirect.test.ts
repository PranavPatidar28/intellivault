import { sanitizeCallbackUrl } from '@/lib/safe-redirect';

describe('sanitizeCallbackUrl', () => {
  describe('falls back for missing/empty input', () => {
    it('returns default fallback for null', () => {
      expect(sanitizeCallbackUrl(null)).toBe('/');
    });

    it('returns default fallback for undefined', () => {
      expect(sanitizeCallbackUrl(undefined)).toBe('/');
    });

    it('returns default fallback for empty string', () => {
      expect(sanitizeCallbackUrl('')).toBe('/');
    });

    it('uses a custom fallback when provided', () => {
      expect(sanitizeCallbackUrl(null, '/dashboard')).toBe('/dashboard');
      expect(sanitizeCallbackUrl('', '/home')).toBe('/home');
    });
  });

  describe('accepts safe same-origin relative paths', () => {
    it('accepts a simple root-relative path', () => {
      expect(sanitizeCallbackUrl('/notes')).toBe('/notes');
    });

    it('accepts a nested path', () => {
      expect(sanitizeCallbackUrl('/notes/123/edit')).toBe('/notes/123/edit');
    });

    it('accepts a path with query string', () => {
      expect(sanitizeCallbackUrl('/notes?page=2&sort=title')).toBe(
        '/notes?page=2&sort=title'
      );
    });

    it('accepts a path with a hash fragment', () => {
      expect(sanitizeCallbackUrl('/notes#section')).toBe('/notes#section');
    });

    it('accepts the bare root path', () => {
      expect(sanitizeCallbackUrl('/')).toBe('/');
    });
  });

  describe('rejects open-redirect / cross-origin attempts', () => {
    it('rejects absolute https URLs', () => {
      expect(sanitizeCallbackUrl('https://evil.com')).toBe('/');
    });

    it('rejects absolute http URLs', () => {
      expect(sanitizeCallbackUrl('http://evil.com')).toBe('/');
    });

    it('rejects protocol-relative // URLs', () => {
      expect(sanitizeCallbackUrl('//evil.com')).toBe('/');
    });

    it('rejects backslash-normalized /\\ URLs', () => {
      expect(sanitizeCallbackUrl('/\\evil.com')).toBe('/');
    });

    it('rejects paths not starting with a slash', () => {
      expect(sanitizeCallbackUrl('evil.com')).toBe('/');
      expect(sanitizeCallbackUrl('notes')).toBe('/');
    });

    it('rejects a smuggled scheme (javascript:) in the path segment', () => {
      // does not start with "/", so rejected outright
      expect(sanitizeCallbackUrl('javascript:alert(1)')).toBe('/');
    });

    it('rejects a colon in the path portion before query/hash', () => {
      expect(sanitizeCallbackUrl('/foo:bar')).toBe('/');
    });

    it('rejects a backslash in the path portion', () => {
      expect(sanitizeCallbackUrl('/foo\\bar')).toBe('/');
    });

    it('allows colons that appear only in the query string', () => {
      // the scheme/control check only inspects the part before ? or #
      expect(sanitizeCallbackUrl('/notes?time=12:30')).toBe('/notes?time=12:30');
    });

    it('uses the custom fallback when rejecting', () => {
      expect(sanitizeCallbackUrl('https://evil.com', '/safe')).toBe('/safe');
    });
  });
});
