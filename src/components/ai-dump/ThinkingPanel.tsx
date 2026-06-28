"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingPanelProps {
    /** The model's reasoning ("thinking") text, possibly streaming. */
    reasoning?: string;
    /** Whether the model is still actively generating. */
    isStreaming?: boolean;
    className?: string;
}

/**
 * Collapsible panel that shows the model's reasoning ("Thinking…") separately
 * from the final answer. Auto-expands while reasoning streams and auto-collapses
 * once generation finishes. The user can always toggle it manually.
 */
export function ThinkingPanel({ reasoning, isStreaming, className }: ThinkingPanelProps) {
    // null = follow auto behavior; boolean = user has taken manual control.
    const [manualOpen, setManualOpen] = useState<boolean | null>(null);
    const bodyRef = useRef<HTMLDivElement>(null);

    // Auto: open while streaming, collapsed once done. Manual choice wins.
    const open = manualOpen ?? !!isStreaming;

    // Keep the latest reasoning in view while it streams and the panel is open.
    useEffect(() => {
        if (open && isStreaming && bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
    }, [reasoning, open, isStreaming]);

    if (!reasoning || reasoning.trim() === "") return null;

    return (
        <div className={cn("rounded-lg border border-border bg-muted/40", className)}>
            <button
                type="button"
                onClick={() => setManualOpen(!open)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={open}
            >
                <Brain className={cn("h-4 w-4", isStreaming && "animate-pulse text-primary")} />
                <span>{isStreaming ? "Thinking…" : "Thoughts"}</span>
                <ChevronDown
                    className={cn(
                        "ml-auto h-4 w-4 transition-transform",
                        open && "rotate-180"
                    )}
                />
            </button>
            {open && (
                <div
                    ref={bodyRef}
                    className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                >
                    {reasoning}
                </div>
            )}
        </div>
    );
}
