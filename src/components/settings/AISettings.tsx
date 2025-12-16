"use client";

import { Brain, Sparkles, Tag, Zap } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import {
    SettingsSection,
    SettingsItem,
    SettingsGroup,
} from "./SettingsLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { LLM_MODELS, type LLMProviderOption } from "@/types/settings";

export function AISettings() {
    const { preferences, isLoading, updatePreferences } = useSettings();

    const handleProviderChange = (provider: LLMProviderOption) => {
        const models = LLM_MODELS[provider];
        updatePreferences({
            defaultLLMProvider: provider,
            defaultLLMModel: models[0]?.value || null,
        });
    };

    const handleModelChange = (model: string) => {
        updatePreferences({ defaultLLMModel: model });
    };

    if (isLoading) {
        return (
            <SettingsSection
                title="AI Features"
                description="Configure AI-powered features"
            >
                <div className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </SettingsSection>
        );
    }

    const currentProvider = preferences?.defaultLLMProvider || "gemini";
    const availableModels = LLM_MODELS[currentProvider as LLMProviderOption] || [];

    return (
        <SettingsSection
            title="AI Features"
            description="Configure AI-powered features and model preferences"
        >
            {/* LLM Provider */}
            <SettingsGroup title="Language Model">
                <SettingsItem
                    label="Default Provider"
                    description="Choose your preferred AI provider for text generation"
                >
                    <Select
                        value={currentProvider}
                        onValueChange={(v) => handleProviderChange(v as LLMProviderOption)}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="gemini">
                                <span className="flex items-center gap-2">
                                    <Sparkles className="h-3 w-3 text-blue-500" />
                                    Gemini
                                </span>
                            </SelectItem>
                            <SelectItem value="openai">
                                <span className="flex items-center gap-2">
                                    <Brain className="h-3 w-3 text-green-500" />
                                    OpenAI
                                </span>
                            </SelectItem>
                            <SelectItem value="ollama">
                                <span className="flex items-center gap-2">
                                    <Zap className="h-3 w-3 text-orange-500" />
                                    Ollama (Local)
                                </span>
                            </SelectItem>
                            <SelectItem value="openrouter">
                                <span className="flex items-center gap-2">
                                    <Brain className="h-3 w-3 text-purple-500" />
                                    OpenRouter
                                </span>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </SettingsItem>

                <SettingsItem
                    label="Default Model"
                    description="The model to use for AI features"
                >
                    <Select
                        value={preferences?.defaultLLMModel || availableModels[0]?.value}
                        onValueChange={handleModelChange}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableModels.map((model) => (
                                <SelectItem key={model.value} value={model.value}>
                                    {model.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </SettingsItem>
            </SettingsGroup>

            {/* Auto Features */}
            <SettingsGroup title="Automation">
                <SettingsItem
                    label="Auto-Summarize"
                    description="Automatically generate summaries for new notes"
                >
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={preferences?.aiAutoSummarize || false}
                            onChange={(e) =>
                                updatePreferences({ aiAutoSummarize: e.target.checked })
                            }
                        />
                        {preferences?.aiAutoSummarize && (
                            <Badge variant="secondary" className="text-xs">
                                Active
                            </Badge>
                        )}
                    </div>
                </SettingsItem>

                <SettingsItem
                    label="Auto-Tag"
                    description="Automatically suggest tags when creating notes"
                >
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={preferences?.aiAutoTag || false}
                            onChange={(e) =>
                                updatePreferences({ aiAutoTag: e.target.checked })
                            }
                        />
                        {preferences?.aiAutoTag && (
                            <Badge variant="secondary" className="text-xs">
                                Active
                            </Badge>
                        )}
                    </div>
                </SettingsItem>
            </SettingsGroup>

            {/* Info */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                    <Brain className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                        AI features use your configured API keys. Make sure you have valid
                        API keys set up in your environment variables for the selected
                        provider.
                    </span>
                </p>
            </div>
        </SettingsSection>
    );
}
