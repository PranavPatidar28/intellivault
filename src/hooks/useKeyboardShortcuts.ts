import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow some shortcuts even in inputs (like Ctrl+F, Escape)
        if (!["Escape", "F"].includes(event.key)) {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl === undefined || shortcut.ctrl === event.ctrlKey;
        const shiftMatches = shortcut.shift === undefined || shortcut.shift === event.shiftKey;
        const altMatches = shortcut.alt === undefined || shortcut.alt === event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          shortcut.handler();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);

  return {
    shortcuts,
  };
}

// Predefined common shortcuts for tags page
export const TAG_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: "F",
    ctrl: true,
    handler: () => {},  // Will be overridden
    description: "Focus search",
  },
  {
    key: "A",
    ctrl: true,
    handler: () => {},  // Will be overridden
    description: "Select all tags",
  },
  {
    key: "Delete",
    handler: () => {},  // Will be overridden
    description: "Delete selected tags",
  },
  {
    key: "Escape",
    handler: () => {},  // Will be overridden
    description: "Clear selection / Close dialogs",
  },
  {
    key: "?",
    shift: true,
    handler: () => {},  // Will be overridden
    description: "Show keyboard shortcuts",
  },
];
