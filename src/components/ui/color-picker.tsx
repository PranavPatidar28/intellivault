"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TAG_COLOR_PALETTE, getRandomColor } from "@/lib/utils/tagColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
    value?: string | null;
    onChange: (color: string) => void;
    className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
    const [customColor, setCustomColor] = useState(value || "");
    const [isOpen, setIsOpen] = useState(false);

    const handleColorSelect = (color: string) => {
        onChange(color);
        setIsOpen(false);
    };

    const handleRandomColor = () => {
        const random = getRandomColor();
        onChange(random);
        setIsOpen(false);
    };

    const handleCustomColorSubmit = () => {
        if (customColor && /^#[0-9A-F]{6}$/i.test(customColor)) {
            onChange(customColor);
            setIsOpen(false);
        }
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn("w-full justify-start", className)}
                >
                    {value ? (
                        <>
                            <div
                                className="w-4 h-4 rounded-full mr-2 border"
                                style={{ backgroundColor: value }}
                            />
                            <span>{value}</span>
                        </>
                    ) : (
                        <span className="text-muted-foreground">Select color</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-3">
                    <div className="grid grid-cols-5 gap-2">
                        {TAG_COLOR_PALETTE.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => handleColorSelect(color.value)}
                                className="w-10 h-10 rounded-md border-2 border-transparent hover:border-primary focus:outline-none focus:border-primary relative transition-all"
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                                aria-label={`Select ${color.name}`}
                            >
                                {value === color.value && (
                                    <Check className="absolute inset-0 m-auto text-white drop-shadow" size={16} />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="pt-2 border-t">
                        <Button
                            variant="outline"
                            className="w-full mb-2"
                            onClick={handleRandomColor}
                        >
                            Random Color
                        </Button>

                        <div className="flex gap-2">
                            <Input
                                type="text"
                                placeholder="#FF5500"
                                value={customColor}
                                onChange={(e) => setCustomColor(e.target.value)}
                                className="flex-1"
                                maxLength={7}
                            />
                            <Button onClick={handleCustomColorSubmit} size="sm">
                                Set
                            </Button>
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
