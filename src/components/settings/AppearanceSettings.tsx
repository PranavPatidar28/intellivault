"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import {
    SettingsSection,
    SettingsItem,
    SettingsGroup,
} from "./SettingsLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { FontSizeOption, DisplayDensityOption } from "@/types/settings";

export function AppearanceSettings() {
    const { theme, setTheme } = useTheme();
    const { preferences, isLoading, updatePreferences } = useSettings();

    const handleThemeChange = (value: string) => {
        if (value) {
            setTheme(value);
            updatePreferences({ theme: value as "light" | "dark" | "system" });
        }
    };

    const handleFontSizeChange = (value: FontSizeOption) => {
        updatePreferences({ fontSize: value });
        // Apply font size to document
        document.documentElement.dataset.fontSize = value;
    };

    const handleDensityChange = (value: DisplayDensityOption) => {
        updatePreferences({ displayDensity: value });
        // Apply density to document
        document.documentElement.dataset.density = value;
    };

    if (isLoading) {
        return (
            <SettingsSection
                title="Appearance"
                description="Customize how IntelliVault looks"
            >
                <div className="space-y-6">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </SettingsSection>
        );
    }

    return (
        <SettingsSection
            title="Appearance"
            description="Customize how IntelliVault looks and feels"
        >
            {/* Theme */}
            <SettingsGroup title="Theme">
                <div className="grid grid-cols-3 gap-3">
                    <ThemeCard
                        label="Light"
                        icon={<Sun className="h-5 w-5" />}
                        isActive={theme === "light"}
                        onClick={() => handleThemeChange("light")}
                    />
                    <ThemeCard
                        label="Dark"
                        icon={<Moon className="h-5 w-5" />}
                        isActive={theme === "dark"}
                        onClick={() => handleThemeChange("dark")}
                    />
                    <ThemeCard
                        label="System"
                        icon={<Monitor className="h-5 w-5" />}
                        isActive={theme === "system"}
                        onClick={() => handleThemeChange("system")}
                    />
                </div>
            </SettingsGroup>

            {/* Font Size */}
            <SettingsGroup title="Typography">
                <SettingsItem
                    label="Font Size"
                    description="Adjust the base font size throughout the app"
                >
                    <Select
                        value={preferences?.fontSize || "medium"}
                        onValueChange={(v) => handleFontSizeChange(v as FontSizeOption)}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingsItem>
            </SettingsGroup>

            {/* Display Density */}
            <SettingsGroup title="Layout">
                <SettingsItem
                    label="Display Density"
                    description="Control spacing between elements"
                >
                    <ToggleGroup
                        type="single"
                        value={preferences?.displayDensity || "comfortable"}
                        onValueChange={(v) =>
                            v && handleDensityChange(v as DisplayDensityOption)
                        }
                        className="border rounded-md"
                    >
                        <ToggleGroupItem value="compact" className="text-xs px-3">
                            Compact
                        </ToggleGroupItem>
                        <ToggleGroupItem value="comfortable" className="text-xs px-3">
                            Comfortable
                        </ToggleGroupItem>
                        <ToggleGroupItem value="spacious" className="text-xs px-3">
                            Spacious
                        </ToggleGroupItem>
                    </ToggleGroup>
                </SettingsItem>
            </SettingsGroup>
        </SettingsSection>
    );
}

interface ThemeCardProps {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

function ThemeCard({ label, icon, isActive, onClick }: ThemeCardProps) {
    return (
        <button
            onClick={onClick}
            className={`
        flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
        ${isActive
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50"
                }
      `}
        >
            <div
                className={`
        p-3 rounded-full
        ${isActive ? "bg-primary text-primary-foreground" : "bg-muted"}
      `}
            >
                {icon}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </button>
    );
}
