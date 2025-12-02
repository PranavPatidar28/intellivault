"use client";

import { useEffect } from "react";
import { useKeyboardShortcuts, KeyboardShortcut } from "@/hooks/useKeyboardShortcuts";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface KeyboardShortcutsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    shortcuts: KeyboardShortcut[];
}

export function KeyboardShortcutsDialog({
    isOpen,
    onClose,
    shortcuts,
}: KeyboardShortcutsDialogProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };

        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    const formatShortcut = (shortcut: KeyboardShortcut) => {
        const keys: string[] = [];
        if (shortcut.ctrl) keys.push("Ctrl");
        if (shortcut.shift) keys.push("Shift");
        if (shortcut.alt) keys.push("Alt");
        keys.push(shortcut.key);
        return keys.join(" + ");
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Keyboard Shortcuts</DialogTitle>
                    <DialogDescription>
                        Use these keyboard shortcuts to navigate and manage tags efficiently
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm">General</h3>
                        <div className="space-y-1">
                            {shortcuts.map((shortcut, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted"
                                >
                                    <span className="text-sm">{shortcut.description}</span>
                                    <Badge variant="outline" className="font-mono">
                                        {formatShortcut(shortcut)}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 border-t pt-4">
                        <h3 className="font-semibold text-sm">Tag Input</h3>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted">
                                <span className="text-sm">Navigate suggestions</span>
                                <Badge variant="outline" className="font-mono">
                                    ↑ / ↓
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted">
                                <span className="text-sm">Select suggestion</span>
                                <Badge variant="outline" className="font-mono">
                                    Enter
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted">
                                <span className="text-sm">Close suggestions</span>
                                <Badge variant="outline" className="font-mono">
                                    Escape
                                </Badge>
                            </div>
                            <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted">
                                <span className="text-sm">Remove last tag</span>
                                <Badge variant="outline" className="font-mono">
                                    Backspace (when empty)
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
