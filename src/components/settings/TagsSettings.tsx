"use client";

import { Tag, Palette } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import {
    SettingsSection,
    SettingsItem,
    SettingsGroup,
} from "./SettingsLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// Predefined color palette for tags
const TAG_COLORS = [
    { value: "#ef4444", label: "Red" },
    { value: "#f97316", label: "Orange" },
    { value: "#eab308", label: "Yellow" },
    { value: "#22c55e", label: "Green" },
    { value: "#06b6d4", label: "Cyan" },
    { value: "#3b82f6", label: "Blue" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#ec4899", label: "Pink" },
    { value: "#6b7280", label: "Gray" },
];

export function TagsSettings() {
    const { preferences, isLoading, updatePreferences } = useSettings();

    if (isLoading) {
        return (
            <SettingsSection
                title="Tags"
                description="Configure tag behavior and defaults"
            >
                <div className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Tags"
            description="Configure how tags work and their default appearance"
        >
            {/* Default Color */}
            <SettingsGroup title="Appearance">
                <SettingsItem
                    label="Default Tag Color"
                    description="Color used for new tags when not specified"
                >
                    <div className="flex flex-wrap gap-2">
                        {TAG_COLORS.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => updatePreferences({ defaultTagColor: color.value })}
                                className={`
                  w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                  ${preferences?.defaultTagColor === color.value
                                        ? "border-foreground ring-2 ring-offset-2 ring-primary"
                                        : "border-transparent"
                                    }
                `}
                                style={{ backgroundColor: color.value }}
                                title={color.label}
                            />
                        ))}
                        <button
                            onClick={() => updatePreferences({ defaultTagColor: null })}
                            className={`
                w-7 h-7 rounded-full border-2 transition-transform hover:scale-110
                flex items-center justify-center text-xs
                ${!preferences?.defaultTagColor
                                    ? "border-foreground ring-2 ring-offset-2 ring-primary bg-muted"
                                    : "border-muted bg-muted"
                                }
              `}
                            title="None (use default)"
                        >
                            ∅
                        </button>
                    </div>
                </SettingsItem>

                {preferences?.defaultTagColor && (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Preview:</span>
                        <Badge
                            style={{
                                backgroundColor: `${preferences.defaultTagColor}20`,
                                color: preferences.defaultTagColor,
                                borderColor: `${preferences.defaultTagColor}40`,
                            }}
                            variant="outline"
                        >
                            Example Tag
                        </Badge>
                    </div>
                )}
            </SettingsGroup>

            {/* Behavior */}
            <SettingsGroup title="Behavior">
                <SettingsItem
                    label="AI Tag Suggestions"
                    description="Show AI-powered tag suggestions when creating notes"
                >
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={preferences?.enableTagSuggestions ?? true}
                            onChange={(e) =>
                                updatePreferences({ enableTagSuggestions: e.target.checked })
                            }
                        />
                        {preferences?.enableTagSuggestions && (
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
                    <Tag className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                        You can also customize individual tag colors directly from the Tags
                        page. These settings apply to newly created tags.
                    </span>
                </p>
            </div>
        </SettingsSection>
    );
}
