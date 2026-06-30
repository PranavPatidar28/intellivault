"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2, Loader2, AlertCircle, CheckCircle2, X, Keyboard } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  SimpleEditor,
  SimpleEditorRef,
} from "./tiptap-templates/simple/simple-editor";
import { TagInput } from "./TagInput";
import { cn } from "@/lib/utils";
import type { JSONContent } from "@tiptap/core";

const DRAFT_KEY = "intellivault_note_draft";
const MAX_TITLE_LENGTH = 200;

interface NoteDraft {
  title: string;
  tags: string[];
  contentJSON?: JSONContent;
  savedAt: number;
}

// Read a recent (< 24h) draft from localStorage. Returns null on miss/parse error.
function readDraft(): NoteDraft | null {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return null;
    const draft: NoteDraft = JSON.parse(saved);
    if (Date.now() - draft.savedAt < 24 * 60 * 60 * 1000) {
      return draft;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

interface NoteModalProps {
  isAddNoteModalOpen: boolean;
  setIsAddNoteModalOpen: (arg: boolean) => void;
  onNoteCreated?: () => void;
}

export default function AddNoteModal({
  isAddNoteModalOpen,
  setIsAddNoteModalOpen,
  onNoteCreated,
}: NoteModalProps) {
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [titleLength, setTitleLength] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const noteTitleRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<SimpleEditorRef>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Latest editor content, kept in a ref so draft save/close reads it without
  // re-rendering on every keystroke.
  const editorContentRef = useRef<JSONContent | undefined>(undefined);
  // Captured once on first render so the editor can mount with the draft body.
  const initialDraftRef = useRef<NoteDraft | null>(null);
  if (initialDraftRef.current === null && typeof window !== "undefined") {
    initialDraftRef.current = readDraft() ?? ({} as NoteDraft);
  }
  const initialContent = initialDraftRef.current?.contentJSON;

  // Load draft (title + tags) on modal open
  useEffect(() => {
    if (isAddNoteModalOpen) {
      const draft = readDraft();
      if (draft) {
        if (noteTitleRef.current && draft.title) {
          noteTitleRef.current.value = draft.title;
          setTitleLength(draft.title.length);
        }
        if (draft.tags) {
          setTags(draft.tags);
        }
      }
      setTimeout(() => noteTitleRef.current?.focus(), 100);
    }
  }, [isAddNoteModalOpen]);

  // Build a draft snapshot from current title/tags/editor content.
  const buildDraft = useCallback((): NoteDraft => {
    const title = noteTitleRef.current?.value || "";
    return {
      title,
      tags,
      contentJSON: editorRef.current?.getJSON() ?? editorContentRef.current,
      savedAt: Date.now(),
    };
  }, [tags]);

  const hasDraftContent = useCallback((draft: NoteDraft): boolean => {
    if (draft.title || draft.tags.length > 0) return true;
    const content = draft.contentJSON?.content;
    return Array.isArray(content) && content.length > 0;
  }, []);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!isAddNoteModalOpen) return;

    const saveDraft = () => {
      const draft = buildDraft();
      if (hasDraftContent(draft)) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    };

    autoSaveTimerRef.current = setInterval(saveDraft, 30000);
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [isAddNoteModalOpen, buildDraft, hasDraftContent]);

  // Track unsaved changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitleLength(e.target.value.length);
    setHasUnsavedChanges(true);
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    setHasUnsavedChanges(true);
  };

  const handleEditorChange = useCallback((content: JSONContent) => {
    editorContentRef.current = content;
    setHasUnsavedChanges(true);
  }, []);

  // Clear draft on successful save
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isAddNoteModalOpen) {
      setError(null);
      setShowSuccess(false);
      setTags([]);
      setTitleLength(0);
      setHasUnsavedChanges(false);
      if (noteTitleRef.current) noteTitleRef.current.value = "";
    }
  }, [isAddNoteModalOpen]);

  const handleSaveNote = useCallback(async () => {
    if (!editorRef.current || !noteTitleRef.current) return;

    const title = noteTitleRef.current.value.trim();
    const contentJSON = editorRef.current.getJSON();
    const contentText = editorRef.current.getText();

    setError(null);

    if (!title) {
      setError("Please enter a title for your note");
      noteTitleRef.current?.focus();
      return;
    }

    if (title.length > MAX_TITLE_LENGTH) {
      setError(`Title is too long (maximum ${MAX_TITLE_LENGTH} characters)`);
      noteTitleRef.current?.focus();
      return;
    }

    if (!contentJSON || !contentJSON.content || contentJSON.content.length === 0) {
      setError("Please enter some content for your note");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, contentJSON, contentText, tags }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setShowSuccess(true);
        clearDraft();
        setHasUnsavedChanges(false);

        setTimeout(() => {
          onNoteCreated?.();
          setIsAddNoteModalOpen(false);
        }, 500);
      } else {
        setError(data.error || "Failed to save note. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }, [tags, onNoteCreated, setIsAddNoteModalOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        if (isAddNoteModalOpen) {
          e.preventDefault();
          handleSaveNote();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddNoteModalOpen, handleSaveNote]);

  const handleOpenChange = (open: boolean) => {
    if (isSaving) return;
    if (!open && hasUnsavedChanges) {
      // Save the full draft (title, tags, and editor body) before closing.
      const draft = buildDraft();
      if (hasDraftContent(draft)) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    }
    setIsAddNoteModalOpen(open);
  };

  return (
    <Dialog open={isAddNoteModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-300",
          isFullScreen
            ? "!inset-0 !translate-x-0 !translate-y-0 !top-0 !left-0 w-screen h-screen max-w-none max-h-none rounded-none border-none"
            : "w-[90vw] h-[85vh] sm:max-w-4xl rounded-xl"
        )}
      >
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0 bg-muted/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="sr-only">New Note</DialogTitle>
              <DialogDescription className="sr-only">
                Create a new note with a title, tags, and rich text content.
              </DialogDescription>
              <div className="space-y-1">
                <input
                  ref={noteTitleRef}
                  className="w-full text-2xl font-bold bg-transparent border-none focus:outline-none placeholder:text-muted-foreground/40"
                  placeholder="Note Title"
                  aria-label="Note title"
                  maxLength={MAX_TITLE_LENGTH}
                  disabled={isSaving}
                  onChange={handleTitleChange}
                />
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className={cn(
                    titleLength > MAX_TITLE_LENGTH * 0.9 && "text-amber-500",
                    titleLength >= MAX_TITLE_LENGTH && "text-destructive"
                  )}>
                    {titleLength}/{MAX_TITLE_LENGTH}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsFullScreen(!isFullScreen)}
                    >
                      {isFullScreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isFullScreen ? "Exit Fullscreen" : "Fullscreen"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => handleOpenChange(false)}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Close</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Tags Section */}
          <div className="pt-3 mt-3 border-t border-border/50">
            <TagInput
              value={tags}
              onChange={handleTagsChange}
              placeholder="Add tags (press Enter or comma to add)..."
              className="min-h-[32px]"
              maxTags={10}
            />
          </div>
        </DialogHeader>

        {/* Editor */}
        <div className="flex-1 min-h-0 overflow-hidden relative bg-background">
          <div className="absolute inset-0 overflow-y-auto">
            <div className="h-full px-6 py-4">
              <SimpleEditor
                ref={editorRef}
                initialContent={initialContent}
                onChange={handleEditorChange}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t bg-muted/30 shrink-0">
          <div className="flex items-center justify-between w-full gap-4">
            {/* Left: Status messages */}
            <div className="flex-1 flex items-center gap-4 overflow-hidden">
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}
              {showSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Saved successfully</span>
                </div>
              )}
              {!error && !showSuccess && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Keyboard className="h-3.5 w-3.5" />
                  <span>Ctrl+Enter to save</span>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveNote} disabled={isSaving || showSuccess}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : showSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Saved
                  </>
                ) : (
                  "Save Note"
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
