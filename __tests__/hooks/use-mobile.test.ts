import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

type Listener = () => void;

function setupMatchMedia() {
  const listeners: Listener[] = [];
  const mql = {
    matches: false,
    addEventListener: jest.fn((_: string, cb: Listener) => {
      listeners.push(cb);
    }),
    removeEventListener: jest.fn((_: string, cb: Listener) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    }),
  };
  const matchMedia = jest.fn(() => mql);
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: matchMedia,
  });
  return { mql, matchMedia, fireChange: () => listeners.forEach((l) => l()) };
}

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe('useIsMobile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when width is below the mobile breakpoint (768)', () => {
    setupMatchMedia();
    setWidth(500);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false when width is at or above the breakpoint', () => {
    setupMatchMedia();
    setWidth(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('treats exactly 768 as non-mobile (boundary)', () => {
    setupMatchMedia();
    setWidth(768);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('registers a matchMedia change listener with the correct query', () => {
    const { matchMedia, mql } = setupMatchMedia();
    setWidth(500);

    renderHook(() => useIsMobile());

    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('updates when the media query change event fires', () => {
    const { fireChange } = setupMatchMedia();
    setWidth(500);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    // Simulate a resize crossing the breakpoint.
    setWidth(1200);
    act(() => {
      fireChange();
    });

    expect(result.current).toBe(false);
  });

  it('removes the listener on unmount', () => {
    const { mql } = setupMatchMedia();
    setWidth(500);

    const { unmount } = renderHook(() => useIsMobile());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
