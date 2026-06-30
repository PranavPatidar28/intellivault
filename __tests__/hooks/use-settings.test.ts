import { renderHook, waitFor, act } from '@testing-library/react';
import { useSettings, useProfile } from '@/hooks/use-settings';

// Mock the preferences provider so useSettings talks to a controllable stub.
const mockCtxUpdate = jest.fn();
let mockCtxValue: any;
jest.mock('@/components/PreferencesProvider', () => ({
  usePreferences: () => mockCtxValue,
}));

// Mock the toast hook so we can assert on it.
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

global.fetch = jest.fn();
const okJson = (data: any, ok = true) => ({ ok, json: async () => data });

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCtxValue = {
      preferences: { id: 'p1', theme: 'system' },
      isLoading: false,
      updatePreferences: mockCtxUpdate,
    };
  });

  it('passes through preferences and isLoading from the provider', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.preferences).toEqual({ id: 'p1', theme: 'system' });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('shows a success toast when the provider update succeeds', async () => {
    mockCtxUpdate.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updatePreferences({ theme: 'dark' });
    });

    expect(mockCtxUpdate).toHaveBeenCalledWith({ theme: 'dark' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Settings saved' })
    );
    expect(result.current.error).toBeNull();
  });

  it('records a local error (no success toast) when the provider update fails', async () => {
    mockCtxUpdate.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updatePreferences({ theme: 'dark' });
    });

    expect(result.current.error).toBe('Failed to save settings');
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('clears a prior error on a subsequent successful update', async () => {
    mockCtxUpdate.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.updatePreferences({ theme: 'dark' });
    });
    expect(result.current.error).toBe('Failed to save settings');

    await act(async () => {
      await result.current.updatePreferences({ theme: 'light' });
    });
    expect(result.current.error).toBeNull();
  });

  it('refetch is a no-op resolved promise (API compatibility)', async () => {
    const { result } = renderHook(() => useSettings());
    await expect(result.current.refetch()).resolves.toBeUndefined();
  });
});

describe('useProfile', () => {
  const sampleProfile = {
    id: 'u1',
    name: 'Pranav',
    email: 'p@example.com',
    image: null,
    emailVerified: true,
    createdAt: '2024-01-01',
    accounts: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the profile on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson(sampleProfile));

    const { result } = renderHook(() => useProfile());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.profile).toEqual(sampleProfile);
    expect(result.current.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledWith('/api/user/profile');
  });

  it('sets error when the fetch response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({}, false));
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch profile');
    expect(result.current.profile).toBeNull();
  });

  it('sets error on network rejection', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('down'));
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('down');
  });

  it('updateProfile optimistically updates then commits server data on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson(sampleProfile));
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.profile).toEqual(sampleProfile));

    (global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ name: 'New Name' })
    );

    await act(async () => {
      await result.current.updateProfile({ name: 'New Name' });
    });

    expect(result.current.profile?.name).toBe('New Name');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Profile updated' })
    );
    expect((global.fetch as jest.Mock).mock.calls[1][1]).toMatchObject({ method: 'PATCH' });
  });

  it('updateProfile rolls back and toasts destructive on failure', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson(sampleProfile));
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.profile).toEqual(sampleProfile));

    (global.fetch as jest.Mock).mockResolvedValueOnce(okJson({}, false));

    await act(async () => {
      await result.current.updateProfile({ name: 'Broken' });
    });

    // rolled back to original name
    expect(result.current.profile?.name).toBe('Pranav');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' })
    );
  });

  it('refetch re-runs the profile fetch', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(okJson(sampleProfile))
      .mockResolvedValueOnce(okJson({ ...sampleProfile, name: 'Refetched' }));

    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.profile?.name).toBe('Pranav'));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.profile?.name).toBe('Refetched'));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
