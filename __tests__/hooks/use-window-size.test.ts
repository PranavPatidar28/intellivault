import { renderHook, act } from '@testing-library/react';
import { useWindowSize } from '@/hooks/use-window-size';

type VVListener = () => void;

function setupVisualViewport(
  initial: Partial<{
    width: number;
    height: number;
    offsetTop: number;
    offsetLeft: number;
    scale: number;
  }> = {}
) {
  const listeners: VVListener[] = [];
  const vp = {
    width: initial.width ?? 1024,
    height: initial.height ?? 768,
    offsetTop: initial.offsetTop ?? 0,
    offsetLeft: initial.offsetLeft ?? 0,
    scale: initial.scale ?? 1,
    addEventListener: jest.fn((_: string, cb: VVListener) => {
      listeners.push(cb);
    }),
    removeEventListener: jest.fn((_: string, cb: VVListener) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    }),
  };
  Object.defineProperty(window, 'visualViewport', {
    writable: true,
    configurable: true,
    value: vp,
  });
  return { vp, fireResize: () => listeners.forEach((l) => l()) };
}

describe('useWindowSize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Drop any pending throttle timer WITHOUT invoking it, so trailing state
    // updates don't fire outside act() during teardown.
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('starts with all-zero state', () => {
    setupVisualViewport();
    // Render but immediately read before throttle trailing fires.
    const { result } = renderHook(() => useWindowSize());

    // Initial render value (throttle is trailing, so not yet applied).
    expect(result.current).toEqual({
      width: 0,
      height: 0,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 0,
    });
  });

  it('reads visual viewport dimensions after the throttle window', () => {
    setupVisualViewport({
      width: 800,
      height: 600,
      offsetTop: 10,
      offsetLeft: 5,
      scale: 1,
    });

    const { result } = renderHook(() => useWindowSize());

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toEqual({
      width: 800,
      height: 600,
      offsetTop: 10,
      offsetLeft: 5,
      scale: 1,
    });
  });

  it('registers a resize listener on the visual viewport', () => {
    const { vp } = setupVisualViewport();
    renderHook(() => useWindowSize());
    expect(vp.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('updates state when the viewport resizes', () => {
    const env = setupVisualViewport({ width: 800, height: 600 });

    const { result } = renderHook(() => useWindowSize());

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.width).toBe(800);

    // Simulate a resize (e.g. mobile keyboard) and let throttle flush.
    env.vp.width = 400;
    env.vp.height = 300;
    act(() => {
      env.fireResize();
      jest.advanceTimersByTime(200);
    });

    expect(result.current.width).toBe(400);
    expect(result.current.height).toBe(300);
  });

  it('does not change the state reference when values are identical', () => {
    const env = setupVisualViewport({ width: 800, height: 600 });

    const { result } = renderHook(() => useWindowSize());

    act(() => {
      jest.advanceTimersByTime(200);
    });
    const snapshot = result.current;

    // Fire another resize with the SAME values; state object identity holds.
    act(() => {
      env.fireResize();
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toBe(snapshot);
  });

  it('removes the resize listener on unmount', () => {
    const { vp } = setupVisualViewport();
    const { unmount } = renderHook(() => useWindowSize());
    unmount();
    expect(vp.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('no-ops when visualViewport is unavailable', () => {
    Object.defineProperty(window, 'visualViewport', {
      writable: true,
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useWindowSize());

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(result.current).toEqual({
      width: 0,
      height: 0,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 0,
    });
  });
});
