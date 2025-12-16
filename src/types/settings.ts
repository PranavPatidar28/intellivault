/**
 * User Settings Types
 */

// Theme options
export type ThemeOption = "light" | "dark" | "system";

// Font size options
export type FontSizeOption = "small" | "medium" | "large";

// Display density options
export type DisplayDensityOption = "compact" | "comfortable" | "spacious";

// LLM Provider options
export type LLMProviderOption = "ollama" | "gemini" | "openai" | "openrouter";

// Note view options
export type NoteViewOption = "grid" | "list";

// Sort order options
export type SortOrderOption = "updatedAt" | "createdAt" | "title" | "title-desc";

// Auto-save interval options (in seconds)
export type AutoSaveIntervalOption = 0 | 15 | 30 | 60 | 300;

/**
 * User Preferences interface matching the Prisma model
 */
export interface UserPreferences {
    id: string;
    userId: string;

    // Appearance
    theme: ThemeOption;
    fontSize: FontSizeOption;
    displayDensity: DisplayDensityOption;

    // AI Settings
    defaultLLMProvider: LLMProviderOption | null;
    defaultLLMModel: string | null;
    aiAutoSummarize: boolean;
    aiAutoTag: boolean;

    // Notes & Editor
    defaultNoteView: NoteViewOption;
    defaultSortOrder: SortOrderOption;
    autoSaveInterval: number;
    showWordCount: boolean;
    spellCheck: boolean;

    // Tags
    defaultTagColor: string | null;
    enableTagSuggestions: boolean;

    // Privacy
    analyticsEnabled: boolean;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Partial preferences for updates
 */
export type UserPreferencesUpdate = Partial<
    Omit<UserPreferences, "id" | "userId" | "createdAt" | "updatedAt">
>;

/**
 * Default preferences used when a user has no saved preferences
 */
export const DEFAULT_PREFERENCES: Omit<UserPreferences, "id" | "userId" | "createdAt" | "updatedAt"> = {
    theme: "system",
    fontSize: "medium",
    displayDensity: "comfortable",
    defaultLLMProvider: null,
    defaultLLMModel: null,
    aiAutoSummarize: false,
    aiAutoTag: false,
    defaultNoteView: "grid",
    defaultSortOrder: "updatedAt",
    autoSaveInterval: 30,
    showWordCount: true,
    spellCheck: true,
    defaultTagColor: null,
    enableTagSuggestions: true,
    analyticsEnabled: true,
};

/**
 * LLM Models by provider
 */
export const LLM_MODELS: Record<LLMProviderOption, { value: string; label: string }[]> = {
    ollama: [
        { value: "llama3.2", label: "Llama 3.2" },
        { value: "llama3.1", label: "Llama 3.1" },
        { value: "mistral", label: "Mistral" },
        { value: "codellama", label: "Code Llama" },
    ],
    gemini: [
        { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
        { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
        { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
    openai: [
        { value: "gpt-4o", label: "GPT-4o" },
        { value: "gpt-4o-mini", label: "GPT-4o Mini" },
        { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
    openrouter: [
        { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
        { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
        { value: "google/gemini-flash-1.5", label: "Gemini Flash 1.5" },
    ],
};
