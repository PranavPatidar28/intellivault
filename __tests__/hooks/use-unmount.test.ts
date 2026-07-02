import { renderHook } from '@testing-library/react';
import { useUnmount } from '@/hooks/use-unmount';

describe('useUnmount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call the callback before unmount', () => {
    const cb = jest.fn();
    renderHook(() => useUnmount(cb));
    expect(cb).not.toHaveBeenCalled();
  });

  it('calls the callback exactly once on unmount', () => {
    const cb = jest.fn();
    const { unmount } = renderHook(() => useUnmount(cb));

    expect(cb).not.toHaveBeenCalled();
    unmount();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not call the callback on re-render, only on unmount', () => {
    const cb = jest.fn();
    const { rerender, unmount } = renderHook(() => useUnmount(cb));

    rerender();
    rerender();
    expect(cb).not.toHaveBeenCalled();

    unmount();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('invokes the latest callback reference at unmount time', () => {
    const first = jest.fn();
    const second = jest.fn();

    const { rerender, unmount } = renderHook(
      ({ callback }) => useUnmount(callback),
      { initialProps: { callback: first } }
    );

    // Swap the callback before unmount; the latest one should be used.
    rerender({ callback: second });
    unmount();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
