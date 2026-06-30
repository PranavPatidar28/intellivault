"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePreferences } from "@/components/PreferencesProvider";
import type { UserPreferences, UserPreferencesUpdate } from "@/types/settings";

interface UseSettingsReturn {
    preferences: UserPreferences | null;
    isLoading: boolean;
    error: string | null;
    updatePreferences: (updates: UserPreferencesUpdate) => Promise<void>;
    refetch: () => Promise<void>;
}

/**
 * Hook for managing user preferences/settings.
 *
 * Reads and writes go through the global PreferencesProvider so every consumer
 * (settings panels, notes/tags pages) shares ONE preference store. Previously
 * this hook kept its own useState + GET + PATCH, which drifted out of sync with
 * the provider: a change made in Settings did not reach /notes until a full
 * reload, and switching settings tabs refetched + re-skeletoned each panel.
 * Now there are no extra fetches (the provider fetches once at app level) and a
 * write is reflected everywhere immediately.
 *
 * The provider's writer reports its outcome directly (true on success, false
 * after rollback) and owns the failure toast. We layer the success toast on
 * top, so each write produces exactly one toast.
 */
export function useSettings(): UseSettingsReturn {
    const { preferences, isLoading, updatePreferences: ctxUpdatePreferences } =
        usePreferences();
    const { toast } = useToast();
    const [error, setError] = useState<string | null>(null);

    const updatePreferences = useCallback(
        async (updates: UserPreferencesUpdate) => {
            setError(null);
            const succeeded = await ctxUpdatePreferences(updates);

            if (succeeded) {
                toast({
                    title: "Settings saved",
                    description: "Your preferences have been updated.",
                });
            } else {
                // The provider already surfaced a destructive error toast and
                // rolled the store back; just record the error locally.
                setError("Failed to save settings");
            }
        },
        [ctxUpdatePreferences, toast]
    );

    // Preferences are fetched once at the provider level; there is nothing to
    // refetch per-panel. Kept for API compatibility with existing callers.
    const refetch = useCallback(async () => {}, []);

    return {
        preferences,
        isLoading,
        error,
        updatePreferences,
        refetch,
    };
}

interface UserProfile {
    id: string;
    name: string;
    email: string;
    image: string | null;
    emailVerified: boolean;
    createdAt: string;
    accounts: Array<{
        providerId: string;
        createdAt: string;
    }>;
}

interface UseProfileReturn {
    profile: UserProfile | null;
    isLoading: boolean;
    error: string | null;
    updateProfile: (updates: { name?: string; image?: string | null }) => Promise<void>;
    refetch: () => Promise<void>;
}

/**
 * Hook for managing user profile
 */
export function useProfile(): UseProfileReturn {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchProfile = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch("/api/user/profile");

            if (!response.ok) {
                throw new Error("Failed to fetch profile");
            }

            const data = await response.json();
            setProfile(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load profile";
            setError(message);
            console.error("Error fetching profile:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateProfile = useCallback(async (updates: { name?: string; image?: string | null }) => {
        const previousProfile = profile;
        if (profile) {
            setProfile({ ...profile, ...updates });
        }

        try {
            const response = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error("Failed to update profile");
            }

            const data = await response.json();
            setProfile({ ...profile!, ...data });

            toast({
                title: "Profile updated",
                description: "Your profile has been saved.",
            });
        } catch (err) {
            setProfile(previousProfile);

            const message = err instanceof Error ? err.message : "Failed to update profile";
            toast({
                title: "Error",
                description: message,
                variant: "destructive",
            });
            console.error("Error updating profile:", err);
        }
    }, [profile, toast]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return {
        profile,
        isLoading,
        error,
        updateProfile,
        refetch: fetchProfile,
    };
}
