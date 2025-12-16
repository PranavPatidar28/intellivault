"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { UserPreferences, UserPreferencesUpdate, DEFAULT_PREFERENCES } from "@/types/settings";

interface UseSettingsReturn {
    preferences: UserPreferences | null;
    isLoading: boolean;
    error: string | null;
    updatePreferences: (updates: UserPreferencesUpdate) => Promise<void>;
    refetch: () => Promise<void>;
}

/**
 * Hook for managing user preferences/settings
 */
export function useSettings(): UseSettingsReturn {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchPreferences = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch("/api/user/preferences");

            if (!response.ok) {
                throw new Error("Failed to fetch preferences");
            }

            const data = await response.json();
            setPreferences(data);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load settings";
            setError(message);
            console.error("Error fetching preferences:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updatePreferences = useCallback(async (updates: UserPreferencesUpdate) => {
        // Optimistic update
        const previousPreferences = preferences;
        if (preferences) {
            setPreferences({ ...preferences, ...updates, updatedAt: new Date() });
        }

        try {
            const response = await fetch("/api/user/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            if (!response.ok) {
                throw new Error("Failed to update preferences");
            }

            const data = await response.json();
            setPreferences(data);

            toast({
                title: "Settings saved",
                description: "Your preferences have been updated.",
            });
        } catch (err) {
            // Rollback on error
            setPreferences(previousPreferences);

            const message = err instanceof Error ? err.message : "Failed to save settings";
            toast({
                title: "Error",
                description: message,
                variant: "destructive",
            });
            console.error("Error updating preferences:", err);
        }
    }, [preferences, toast]);

    useEffect(() => {
        fetchPreferences();
    }, [fetchPreferences]);

    return {
        preferences,
        isLoading,
        error,
        updatePreferences,
        refetch: fetchPreferences,
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
