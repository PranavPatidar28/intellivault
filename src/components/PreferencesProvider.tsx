"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { useToast } from "@/hooks/use-toast";
import type { UserPreferences, UserPreferencesUpdate } from "@/types/settings";
import { DEFAULT_PREFERENCES } from "@/types/settings";

interface PreferencesContextType {
    preferences: UserPreferences | null;
    isLoading: boolean;
    updatePreferences: (updates: UserPreferencesUpdate) => Promise<boolean>;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

/**
 * Hook to access user preferences from context
 */
export function usePreferences() {
    const context = useContext(PreferencesContext);
    if (!context) {
        // Return default values if used outside provider (e.g., public pages)
        return {
            preferences: null,
            isLoading: true,
            updatePreferences: async () => false,
        };
    }
    return context;
}

interface PreferencesProviderProps {
    children: ReactNode;
}

/**
 * Provider that fetches and applies user preferences globally
 */
export function PreferencesProvider({ children }: PreferencesProviderProps) {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Fetch preferences on mount
    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                const response = await fetch("/api/user/preferences");
                if (response.ok) {
                    const data = await response.json();
                    setPreferences(data);
                }
            } catch (error) {
                console.error("Failed to fetch preferences:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPreferences();
    }, []);

    // Apply appearance settings to document
    useEffect(() => {
        if (!preferences) return;

        // Apply font size
        const fontSizeMap = {
            small: "14px",
            medium: "16px",
            large: "18px",
        };
        document.documentElement.style.setProperty(
            "--base-font-size",
            fontSizeMap[preferences.fontSize as keyof typeof fontSizeMap] || "16px"
        );
        document.documentElement.dataset.fontSize = preferences.fontSize;

        // Apply display density
        const densityMap = {
            compact: { spacing: "0.5rem", padding: "0.5rem" },
            comfortable: { spacing: "1rem", padding: "1rem" },
            spacious: { spacing: "1.5rem", padding: "1.5rem" },
        };
        const density = densityMap[preferences.displayDensity as keyof typeof densityMap] || densityMap.comfortable;
        document.documentElement.style.setProperty("--content-spacing", density.spacing);
        document.documentElement.style.setProperty("--content-padding", density.padding);
        document.documentElement.dataset.density = preferences.displayDensity;

    }, [preferences]);

    const updatePreferences = useCallback(
        async (updates: UserPreferencesUpdate): Promise<boolean> => {
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
                return true;
            } catch (error) {
                // Rollback on error
                setPreferences(previousPreferences);
                toast({
                    title: "Error",
                    description: "Failed to save settings",
                    variant: "destructive",
                });
                console.error("Error updating preferences:", error);
                return false;
            }
        },
        [preferences, toast]
    );

    return (
        <PreferencesContext.Provider
            value={{ preferences, isLoading, updatePreferences }}
        >
            {children}
        </PreferencesContext.Provider>
    );
}
