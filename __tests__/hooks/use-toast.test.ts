import { renderHook } from '@testing-library/react';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSuccess = sonnerToast.success as unknown as jest.Mock;
const mockError = sonnerToast.error as unknown as jest.Mock;

describe('useToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a stable toast function', () => {
    const { result } = renderHook(() => useToast());
    expect(typeof result.current.toast).toBe('function');
  });

  it('calls sonner success for the default variant', () => {
    const { result } = renderHook(() => useToast());

    result.current.toast({ title: 'Saved', description: 'All good' });

    expect(mockSuccess).toHaveBeenCalledTimes(1);
    expect(mockSuccess).toHaveBeenCalledWith('Saved', { description: 'All good' });
    expect(mockError).not.toHaveBeenCalled();
  });

  it('calls sonner success when variant is explicitly "default"', () => {
    const { result } = renderHook(() => useToast());

    result.current.toast({ title: 'Hi', variant: 'default' });

    expect(mockSuccess).toHaveBeenCalledWith('Hi', { description: undefined });
    expect(mockError).not.toHaveBeenCalled();
  });

  it('calls sonner error for the destructive variant', () => {
    const { result } = renderHook(() => useToast());

    result.current.toast({
      title: 'Oops',
      description: 'Something broke',
      variant: 'destructive',
    });

    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError).toHaveBeenCalledWith('Oops', { description: 'Something broke' });
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it('handles missing title and description', () => {
    const { result } = renderHook(() => useToast());

    result.current.toast({});

    expect(mockSuccess).toHaveBeenCalledWith(undefined, { description: undefined });
  });
});
