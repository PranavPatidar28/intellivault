import { cn } from '@/lib/utils';

describe('cn (className merge utility)', () => {
  it('should merge simple class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should return empty string for no args', () => {
    expect(cn()).toBe('');
  });

  it('should ignore falsy values', () => {
    expect(cn('foo', false, null, undefined, '', 'bar')).toBe('foo bar');
  });

  it('should handle conditional object syntax (clsx)', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('should dedupe/override conflicting tailwind classes (twMerge)', () => {
    // twMerge keeps the last conflicting utility.
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('should keep non-conflicting tailwind classes', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });

  it('should resolve conflicts across conditional inputs', () => {
    const result = cn('text-sm', { 'text-lg': true });
    expect(result).toBe('text-lg');
  });

  it('should handle a mix of strings, arrays, and objects', () => {
    const result = cn('a', ['b', { c: true, d: false }], undefined, 'e');
    expect(result).toBe('a b c e');
  });
});
