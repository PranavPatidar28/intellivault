import { renderHook, act } from '@testing-library/react';
import { useIsBreakpoint } from '@/hooks/use-is-breakpoint';

type ChangeListener = (e: { matches: boolean }) => void;

function setupMatchMedia(initialMatches = false) {
  const listeners: ChangeListener[] = [];
  const mql = {
    matches: initialMatches,
    addEventListener: jest.fn((_: string, cb: ChangeListener) => {
      listeners.push(cb);
    }),
    removeEventListener: jest.fn((_: string, cb: ChangeListener) => {
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
  return {
    mql,
    matchMedia,
    fireChange: (matches: boolean) =>
      listeners.forEach((l) => l({ matches })),
  };
}

describe('useIsBreakpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to max mode at 768 and uses a max-width query', () => {
    const { matchMedia } = setupMatchMedia(true);

    const { result } = renderHook(() => useIsBreakpoint());

    expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    expect(result.current).toBe(true);
  });

  it('builds a min-width query in min mode', () => {
    const { matchMedia } = setupMatchMedia(true);

    const { result } = renderHook(() => useIsBreakpoint('min', 1024));

    expect(matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    expect(result.current).toBe(true);
  });

  it('builds a max-width query (breakpoint - 1) in max mode with a custom value', () => {
    const { matchMedia } = setupMatchMedia(false);

    const { result } = renderHook(() => useIsBreakpoint('max', 1280));

    expect(matchMedia).toHaveBeenCalledWith('(max-width: 1279px)');
    expect(result.current).toBe(false);
  });

  it('reflects the initial mql.matches value', () => {
    setupMatchMedia(false);
    const { result } = renderHook(() => useIsBreakpoint('min', 600));
    expect(result.current).toBe(false);
  });

  it('updates when the change event fires', () => {
    const { fireChange } = setupMatchMedia(false);

    const { result } = renderHook(() => useIsBreakpoint('max', 768));
    expect(result.current).toBe(false);

    act(() => {
      fireChange(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      fireChange(false);
    });
    expect(result.current).toBe(false);
  });

  it('removes the listener on unmount', () => {
    const { mql } = setupMatchMedia(true);

    const { unmount } = renderHook(() => useIsBreakpoint());
    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('re-subscribes with a new query when mode/breakpoint change', () => {
    const { matchMedia, mql } = setupMatchMedia(false);

    const { rerender } = renderHook(
      ({ mode, bp }: { mode: 'min' | 'max'; bp: number }) =>
        useIsBreakpoint(mode, bp),
      { initialProps: { mode: 'max' as const, bp: 768 } }
    );

    expect(matchMedia).toHaveBeenLastCalledWith('(max-width: 767px)');

    rerender({ mode: 'min', bp: 1024 });

    expect(mql.removeEventListener).toHaveBeenCalled();
    expect(matchMedia).toHaveBeenLastCalledWith('(min-width: 1024px)');
  });
});
