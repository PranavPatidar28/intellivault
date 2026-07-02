import { renderHook } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  TAG_SHORTCUTS,
  type KeyboardShortcut,
} from '@/hooks/useKeyboardShortcuts';

/**
 * Dispatch a keydown event on a given target (defaults to document.body, a DIV
 * so it is not treated as an input).
 */
function fireKeyDown(
  init: KeyboardEventInit,
  target: EventTarget = document.body
) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  // jsdom does not let `target` be set via init, so define it explicitly.
  Object.defineProperty(event, 'target', { value: target, enumerable: true });
  window.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the shortcuts passed in', () => {
    const shortcuts: KeyboardShortcut[] = [
      { key: 's', handler: jest.fn(), description: 'Save' },
    ];
    const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts }));
    expect(result.current.shortcuts).toBe(shortcuts);
  });

  it('fires the handler for a plain key match', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKeyDown({ key: 'a' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('matches keys case-insensitively', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'A', handler, description: 'A' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKeyDown({ key: 'a' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('respects ctrl modifier requirement', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'f', ctrl: true, handler, description: 'Find' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    // Without ctrl -> no fire
    fireKeyDown({ key: 'f' });
    expect(handler).not.toHaveBeenCalled();

    // With ctrl -> fire
    fireKeyDown({ key: 'f', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('respects shift and alt modifier requirements', () => {
    const shiftHandler = jest.fn();
    const altHandler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: '?', shift: true, handler: shiftHandler, description: 'Help' },
      { key: 'x', alt: true, handler: altHandler, description: 'Alt X' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKeyDown({ key: '?' });
    expect(shiftHandler).not.toHaveBeenCalled();
    fireKeyDown({ key: '?', shiftKey: true });
    expect(shiftHandler).toHaveBeenCalledTimes(1);

    fireKeyDown({ key: 'x' });
    expect(altHandler).not.toHaveBeenCalled();
    fireKeyDown({ key: 'x', altKey: true });
    expect(altHandler).toHaveBeenCalledTimes(1);
  });

  it('does not require a modifier when it is undefined (matches either state)', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'g', handler, description: 'Go' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    // ctrl undefined -> still matches even when ctrl pressed
    fireKeyDown({ key: 'g', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault when a shortcut matches', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const event = fireKeyDown({ key: 'a' });
    expect(event.defaultPrevented).toBe(true);
  });

  it('only fires the first matching shortcut (break)', () => {
    const first = jest.fn();
    const second = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler: first, description: 'first' },
      { key: 'a', handler: second, description: 'second' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    fireKeyDown({ key: 'a' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it('does nothing when enabled is false', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts, enabled: false }));

    fireKeyDown({ key: 'a' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts while typing in an INPUT (non-Escape/F key)', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const input = document.createElement('input');
    fireKeyDown({ key: 'a' }, input);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts while typing in a TEXTAREA', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const textarea = document.createElement('textarea');
    fireKeyDown({ key: 'a' }, textarea);
    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores shortcuts in a contentEditable element', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true });
    fireKeyDown({ key: 'a' }, div);
    expect(handler).not.toHaveBeenCalled();
  });

  it('still allows Escape while typing in an input', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'Escape', handler, description: 'Close' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const input = document.createElement('input');
    fireKeyDown({ key: 'Escape' }, input);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('still allows F while typing in an input', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'F', ctrl: true, handler, description: 'Find' },
    ];
    renderHook(() => useKeyboardShortcuts({ shortcuts }));

    const input = document.createElement('input');
    fireKeyDown({ key: 'F', ctrlKey: true }, input);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('removes the keydown listener on unmount', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({ shortcuts })
    );

    unmount();
    fireKeyDown({ key: 'a' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not attach a listener when enabled is false (no fire after enabling toggled off)', () => {
    const handler = jest.fn();
    const shortcuts: KeyboardShortcut[] = [
      { key: 'a', handler, description: 'A' },
    ];
    const { rerender } = renderHook(
      ({ enabled }) => useKeyboardShortcuts({ shortcuts, enabled }),
      { initialProps: { enabled: true } }
    );

    fireKeyDown({ key: 'a' });
    expect(handler).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    fireKeyDown({ key: 'a' });
    expect(handler).toHaveBeenCalledTimes(1); // unchanged
  });

  it('exposes a TAG_SHORTCUTS preset with the expected keys', () => {
    const keys = TAG_SHORTCUTS.map((s) => s.key);
    expect(keys).toEqual(['F', 'A', 'Delete', 'Escape', '?']);
    // Every preset has a description and a (placeholder) handler.
    for (const s of TAG_SHORTCUTS) {
      expect(typeof s.description).toBe('string');
      expect(typeof s.handler).toBe('function');
    }
  });
});
