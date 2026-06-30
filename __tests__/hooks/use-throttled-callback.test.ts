import { renderHook, act } from '@testing-library/react';
import { useThrottledCallback } from '@/hooks/use-throttled-callback';

describe('useThrottledCallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('returns a callable with cancel and flush methods', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 200));

    expect(typeof result.current).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
    expect(typeof result.current.flush).toBe('function');
  });

  it('throttles invocations within the wait window (trailing by default)', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 200));

    act(() => {
      result.current();
      result.current();
      result.current();
    });

    // Default options: leading false, trailing true -> no immediate call.
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments through to the underlying function', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 100));

    act(() => {
      result.current('a', 42);
      jest.advanceTimersByTime(100);
    });

    expect(fn).toHaveBeenCalledWith('a', 42);
  });

  it('respects leading: true option', () => {
    const fn = jest.fn();
    const { result } = renderHook(() =>
      useThrottledCallback(fn, 200, [], { leading: true, trailing: false })
    );

    act(() => {
      result.current();
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel() prevents a pending trailing invocation', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 200));

    act(() => {
      result.current();
      result.current.cancel();
      jest.advanceTimersByTime(500);
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it('flush() invokes a pending trailing call immediately', () => {
    const fn = jest.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 200));

    act(() => {
      result.current('x');
      result.current.flush();
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('x');
  });

  it('cancels the throttled handler on unmount', () => {
    const fn = jest.fn();
    const { result, unmount } = renderHook(() =>
      useThrottledCallback(fn, 200)
    );

    const cancelSpy = jest.spyOn(result.current, 'cancel');

    act(() => {
      result.current();
    });

    unmount();

    expect(cancelSpy).toHaveBeenCalled();

    // The pending trailing call should never fire after unmount/cancel.
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('memoizes the handler across renders when dependencies are stable', () => {
    const fn = jest.fn();
    const { result, rerender } = renderHook(() =>
      useThrottledCallback(fn, 200, [])
    );

    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('recreates the handler when dependencies change', () => {
    const fn = jest.fn();
    const { result, rerender } = renderHook(
      ({ dep }: { dep: number }) => useThrottledCallback(fn, 200, [dep]),
      { initialProps: { dep: 1 } }
    );

    const first = result.current;
    rerender({ dep: 2 });
    expect(result.current).not.toBe(first);
  });
});
