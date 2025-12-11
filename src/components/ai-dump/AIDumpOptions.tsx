"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AIDumpOptions } from "@/lib/validations/ai-dump";

// ============================================================================
// Types
// ============================================================================

interface AIDumpOptionsProps {
    options: AIDumpOptions;
    onOptionsChange: (options: Partial<AIDumpOptions>) => void;
    isProcessing: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AIDumpOptionsPanel({
    options,
    onOptionsChange,
    isProcessing,
}: AIDumpOptionsProps) {
    const handleTemplateChange = (value: AIDumpOptions["template"]) => {
        onOptionsChange({ template: value });
    };

    const handleToneChange = (value: AIDumpOptions["tone"]) => {
        onOptionsChange({ tone: value });
    };

    const handleToggleChange = (key: keyof AIDumpOptions["toggles"]) => {
        onOptionsChange({
            toggles: {
                ...options.toggles,
                [key]: !options.toggles[key],
            },
        });
    };

    const handleTemperatureChange = (value: number) => {
        onOptionsChange({ temperature: value });
    };

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Template Selection */}
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Template
                    </Label>
                    <Select
                        value={options.template}
                        onValueChange={handleTemplateChange}
                        disabled={isProcessing}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto">Auto-detect</SelectItem>
                            <SelectItem value="meeting">Meeting Notes</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                            <SelectItem value="code">Code/Technical</SelectItem>
                            <SelectItem value="lecture">Lecture Notes</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Separator />

                {/* Output Toggles */}
                <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Generate
                    </Label>
                    <div className="space-y-2">
                        <ToggleOption
                            label="Title Variants"
                            checked={options.toggles.titles}
                            onChange={() => handleToggleChange("titles")}
                            disabled={isProcessing}
                        />
                        <ToggleOption
                            label="Tags"
                            checked={options.toggles.tags}
                            onChange={() => handleToggleChange("tags")}
                            disabled={isProcessing}
                        />
                        <ToggleOption
                            label="Structured Markdown"
                            checked={options.toggles.markdown}
                            onChange={() => handleToggleChange("markdown")}
                            disabled={isProcessing}
                        />
                        <ToggleOption
                            label="Action Items"
                            checked={options.toggles.actions}
                            onChange={() => handleToggleChange("actions")}
                            disabled={isProcessing}
                        />
                        <ToggleOption
                            label="Preserve Code Blocks"
                            checked={options.toggles.preserveCode}
                            onChange={() => handleToggleChange("preserveCode")}
                            disabled={isProcessing}
                        />
                    </div>
                </div>

                <Separator />

                {/* Tone Selection */}
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        Tone
                    </Label>
                    <Select
                        value={options.tone}
                        onValueChange={handleToneChange}
                        disabled={isProcessing}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="balanced">Balanced</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="technical">Technical</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <Separator />

                {/* Temperature Slider */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                            Creativity
                        </Label>
                        <span className="text-xs text-muted-foreground">
                            {options.temperature.toFixed(1)}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={options.temperature}
                        onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                        disabled={isProcessing}
                        className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Precise</span>
                        <span>Creative</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ToggleOptionProps {
    label: string;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
}

function ToggleOption({ label, checked, onChange, disabled }: ToggleOptionProps) {
    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
                checked={checked}
                onCheckedChange={onChange}
                disabled={disabled}
            />
            <span className="text-sm">{label}</span>
        </label>
    );
}
