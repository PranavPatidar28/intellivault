"use client";

import { LayoutGrid, List } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import {
    SettingsSection,
    SettingsItem,
    SettingsGroup,
} from "./SettingsLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { NoteViewOption, SortOrderOption } from "@/types/settings";

export function NotesSettings() {
    const { preferences, isLoading, updatePreferences } = useSettings();

    if (isLoading) {
        return (
            <SettingsSection
                title="Notes & Editor"
                description="Configure note display and editor preferences"
            >
                <div className="space-y-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Notes & Editor"
            description="Configure how notes are displayed and edited"
        >
            {/* Display Preferences */}
            <SettingsGroup title="Display">
                <SettingsItem
                    label="Default View"
                    description="How notes are displayed on the notes page"
                >
                    <ToggleGroup
                        type="single"
                        value={preferences?.defaultNoteView || "grid"}
                        onValueChange={(v) =>
                            v && updatePreferences({ defaultNoteView: v as NoteViewOption })
                        }
                        className="border rounded-md"
                    >
                        <ToggleGroupItem value="grid" className="gap-1.5 px-3">
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Grid
                        </ToggleGroupItem>
                        <ToggleGroupItem value="list" className="gap-1.5 px-3">
                            <List className="h-3.5 w-3.5" />
                            List
                        </ToggleGroupItem>
                    </ToggleGroup>
                </SettingsItem>

                <SettingsItem
                    label="Default Sort"
                    description="How notes are sorted by default"
                >
                    <Select
                        value={preferences?.defaultSortOrder || "updatedAt"}
                        onValueChange={(v) =>
                            updatePreferences({ defaultSortOrder: v as SortOrderOption })
                        }
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="updatedAt">Last Modified</SelectItem>
                            <SelectItem value="createdAt">Date Created</SelectItem>
                            <SelectItem value="title">Title A-Z</SelectItem>
                            <SelectItem value="title-desc">Title Z-A</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingsItem>
            </SettingsGroup>

            {/* Editor Preferences */}
            <SettingsGroup title="Editor">
                <SettingsItem
                    label="Auto-Save Interval"
                    description="How often to automatically save changes"
                >
                    <Select
                        value={String(preferences?.autoSaveInterval ?? 30)}
                        onValueChange={(v) =>
                            updatePreferences({ autoSaveInterval: parseInt(v) })
                        }
                    >
                        <SelectTrigger className="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">Disabled</SelectItem>
                            <SelectItem value="15">15 seconds</SelectItem>
                            <SelectItem value="30">30 seconds</SelectItem>
                            <SelectItem value="60">1 minute</SelectItem>
                            <SelectItem value="300">5 minutes</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingsItem>

                <SettingsItem
                    label="Show Word Count"
                    description="Display word count in the editor footer"
                >
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={preferences?.showWordCount ?? true}
                        onChange={(e) =>
                            updatePreferences({ showWordCount: e.target.checked })
                        }
                    />
                </SettingsItem>

                <SettingsItem
                    label="Spell Check"
                    description="Enable browser spell checking in the editor"
                >
                    <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        checked={preferences?.spellCheck ?? true}
                        onChange={(e) =>
                            updatePreferences({ spellCheck: e.target.checked })
                        }
                    />
                </SettingsItem>
            </SettingsGroup>
        </SettingsSection>
    );
}
