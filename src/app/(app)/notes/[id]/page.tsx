"use client";

import NoteTitle from "@/components/NoteTitle";
import {
  SimpleEditorRef,
  SimpleEditor,
} from "@/components/tiptap-templates/simple/simple-editor";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ConfirmationDialog";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowLeftIcon,
  SaveIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  ClockIcon,
} from "lucide-react";
import { Note } from "@/types/note";
import { NoteEditorSkeleton } from "@/components/skeletons/note-skeleton";
import { getRelativeTime } from "@/lib/utils/text";
import { Tag } from "@/components/TagInput";
import { NoteTags } from "@/components/NoteTags";
import { AISidebar } from "@/components/AISidebar";
import { markdownToTipTap } from "@/lib/utils/markdown-to-tiptap";
import { usePreferences } from "@/components/PreferencesProvider";

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const { preferences } = usePreferences();
  const [note, setNote] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastEditTime, setLastEditTime] = useState<Date | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);
  const [isContentEmpty, setIsContentEmpty] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const editorRef = useRef<SimpleEditorRef>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  // Guards against overlapping manual + autosave PUTs (state lags inside the
  // same tick, so we track the in-flight save in a ref too).
  const isSavingRef = useRef(false);

  // Load AI sidebar state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("ai-sidebar-open");
    if (stored === "true") {
      setIsAISidebarOpen(true);
    }
  }, []);

  const toggleAISidebar = () => {
    const newState = !isAISidebarOpen;
    setIsAISidebarOpen(newState);
    localStorage.setItem("ai-sidebar-open", String(newState));
  };

  const noteId = params.id as string;

  // Fetch note data on component mount
  useEffect(() => {
    const fetchNote = async () => {
      try {
        const response = await fetch(`/api/notes/${noteId}`);
        const data = await response.json();

        if (response.ok && data.success && data.note) {
          const fetchedNote = data.note;
          setNote(fetchedNote);
          setNoteTitle(fetchedNote.title);
          setTags(fetchedNote.tags || []);
          setLastSaved(new Date(fetchedNote.updatedAt));
        } else {
          setErrorMessage("Note not found");
          setTimeout(() => router.push("/notes"), 2000);
        }
      } catch {
        setErrorMessage("Failed to load note. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    };

    if (noteId) {
      fetchNote();
    }
  }, [noteId, router]);

  const handleSaveNote = useCallback(async (isAutoSave: boolean = false) => {
    // Prevent overlapping saves (manual Ctrl+S/button racing the autosave timer).
    if (isSavingRef.current) {
      return;
    }

    if (!editorRef.current || !noteTitle.trim()) {
      if (!isAutoSave) {
        setErrorMessage("Title is required");
        setSaveStatus("error");
      }
      return;
    }

    const title = noteTitle.trim();
    const contentJSON = editorRef.current.getJSON();
    const contentText = editorRef.current.getText();

    if (!contentJSON || !contentJSON.content || contentJSON.content.length === 0) {
      // Empty content is not persisted. Surface this clearly rather than
      // silently no-op'ing: keep the unsaved indicator and show why on a
      // manual save. The Save button is also disabled while empty.
      setIsContentEmpty(true);
      if (!isAutoSave) {
        setErrorMessage("Content cannot be empty");
        setSaveStatus("error");
      }
      return;
    }

    setIsContentEmpty(false);
    // A manual save supersedes any pending autosave.
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          contentJSON,
          contentText,
          tags: tags.map(t => t.name)
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSaveStatus("saved");
        setNote(data.note);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        setLastEditTime(null);

        // Clear success message after 2 seconds
        setTimeout(() => {
          setSaveStatus((current) => current === "saved" ? null : current);
        }, 2000);
      } else {
        setSaveStatus("error");
        setErrorMessage(data.error || "Failed to update note");
      }
    } catch {
      setSaveStatus("error");
      setErrorMessage("Network error. Please check your connection.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [noteId, noteTitle, tags]);

  const handleGoBack = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        "You have unsaved changes. Are you sure you want to leave?"
      );
      if (!confirmLeave) return;
    }
    router.push("/notes");
  }, [hasUnsavedChanges, router]);

  const handleEditorChange = useCallback(() => {
    setHasUnsavedChanges(true);
    setLastEditTime(new Date());
    setSaveStatus(null);
    setIsContentEmpty(false);
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setNoteTitle(newTitle);
    setHasUnsavedChanges(true);
    setLastEditTime(new Date());
    setSaveStatus(null);
  };

  // Auto-save with debouncing (uses user preferences for interval)
  useEffect(() => {
    // Get auto-save interval from preferences (default 30 seconds, 0 = disabled)
    const autoSaveInterval = preferences?.autoSaveInterval ?? 30;

    if (autoSaveInterval === 0) {
      // Auto-save disabled
      return;
    }

    if (lastEditTime && hasUnsavedChanges) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Use user's preferred interval (minimum 3 seconds for safety)
      const interval = Math.max(autoSaveInterval * 1000, 3000);
      autoSaveTimerRef.current = setTimeout(() => {
        handleSaveNote(true);
      }, interval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [lastEditTime, hasUnsavedChanges, handleSaveNote, preferences?.autoSaveInterval]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveNote(false);
      }

      // Esc to go back — but only when it isn't being used to dismiss
      // something else (Radix Select/dialog popovers call preventDefault) and
      // focus isn't inside an editable surface where Esc has local meaning.
      if (e.key === "Escape") {
        if (e.defaultPrevented) return;

        const target = e.target as HTMLElement | null;
        const inEditable =
          !!target &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
            !!target.closest('[role="dialog"], [role="listbox"], [contenteditable="true"], .ProseMirror'));
        if (inEditable) return;

        // An open overlay (delete dialog / mobile AI sheet) owns Escape.
        if (showDeleteDialog) return;

        handleGoBack();
      }

      // Ctrl+\ to toggle AI Sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleAISidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveNote, handleGoBack, showDeleteDialog]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Keep the "Saved X ago" relative timestamp fresh while the page stays open.
  useEffect(() => {
    if (!lastSaved) return;
    const interval = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [lastSaved]);

  const handleDeleteNote = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.push("/notes");
      } else {
        setErrorMessage(data.error || "Failed to delete note");
        setSaveStatus("error");
      }
    } catch {
      setErrorMessage("Failed to delete note. Please try again.");
      setSaveStatus("error");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <Topbar>
          <div className="text-lg font-semibold">Loading note...</div>
        </Topbar>
        <NoteEditorSkeleton />
      </div>
    );
  }

  if (!note) {
    return (
      <div>
        <Topbar>
          <div className="text-lg font-semibold">Note not found</div>
        </Topbar>
        <div className="flex flex-col items-center justify-center p-12">
          <AlertCircleIcon size={48} className="text-destructive mb-4" />
          <p className="text-muted-foreground">
            {errorMessage || "This note doesn't exist"}
          </p>
        </div>
      </div>
    );
  }

  // Recomputed each minute via nowTick so the relative label doesn't go stale.
  void nowTick;
  const savedAgoLabel = lastSaved ? getRelativeTime(lastSaved) : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Topbar>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleGoBack} className="shrink-0" aria-label="Back to notes" title="Back to notes">
            <ArrowLeftIcon size={16} />
          </Button>
          <NoteTitle initialTitle={noteTitle} onTitleChange={handleTitleChange} />
        </div>



        <div className="flex gap-2 items-center">
          <div className="flex gap-2 items-center">
            {/* Save state — one clear indicator at a time */}
            {saveStatus === "saving" || isSaving ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                <span>Saving…</span>
              </div>
            ) : saveStatus === "error" && errorMessage ? (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircleIcon size={16} />
                <span>{errorMessage}</span>
              </div>
            ) : isContentEmpty ? (
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircleIcon size={12} />
                <span>Add content to save</span>
              </div>
            ) : hasUnsavedChanges ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon size={12} />
                <span>Unsaved changes</span>
              </div>
            ) : saveStatus === "saved" ? (
              <div className="flex items-center gap-1 text-sm text-success">
                <CheckCircleIcon size={16} />
                <span>Saved</span>
              </div>
            ) : savedAgoLabel ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ClockIcon size={12} />
                <span>Saved {savedAgoLabel}</span>
              </div>
            ) : null}
          </div>

          <Button
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting || isSaving}
            variant="destructive"
            size="sm"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <TrashIcon size={16} className="mr-2" />
                Delete
              </>
            )}
          </Button>

          <Button
            onClick={() => handleSaveNote(false)}
            disabled={isSaving || !hasUnsavedChanges || isContentEmpty}
            size="sm"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Saving...
              </>
            ) : (
              <>
                <SaveIcon size={16} className="mr-2" />
                {hasUnsavedChanges ? "Save Changes" : "Saved"}
              </>
            )}
          </Button>
        </div>
      </Topbar>

      {/* Main content area with flex layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Column: Tags + Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tags bar */}
          <div className="px-4 py-2 border-b shrink-0">
            <NoteTags
              tags={tags}
              onChange={(newTags) => {
                setTags(newTags);
                setHasUnsavedChanges(true);
                setLastEditTime(new Date());
                setSaveStatus(null);
              }}
            />
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-auto">
            <SimpleEditor
              ref={editorRef}
              initialContent={
                // If contentJSON is empty (e.g. from AI Dump), convert contentText markdown to TipTap format
                note.contentJSON && Object.keys(note.contentJSON).length > 0
                  ? note.contentJSON
                  : note.contentText
                    ? markdownToTipTap(note.contentText)
                    : undefined
              }
              onChange={handleEditorChange}
            />
          </div>
        </div>

        {/* Right Column: AI Sidebar (Persistent) */}
        <AISidebar
          noteId={noteId}
          currentTags={tags}
          isOpen={isAISidebarOpen}
          onToggle={toggleAISidebar}
          onApplyTags={(tagNames) => {
            setTags((prev) => {
              const existing = new Set(prev.map((t) => t.name.toLowerCase()));
              const newTags = tagNames
                .filter((name) => !existing.has(name.toLowerCase()))
                .map((name) => ({
                  id: `temp-${Date.now()}-${name}`,
                  name,
                  color: null,
                }));
              if (newTags.length === 0) return prev;
              return [...prev, ...newTags];
            });
            setHasUnsavedChanges(true);
            setLastEditTime(new Date());
          }}
          onApplyTitle={(title) => {
            setNoteTitle(title);
            setHasUnsavedChanges(true);
            setLastEditTime(new Date());
          }}
          content={editorRef.current?.getText() || note.contentText}
          initialSummary={note.summary}
          initialGeneratedTitle={note.generatedTitle}
        />
      </div>

      <DeleteDialog
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDeleteNote}
        title="Delete Note"
        description="This action cannot be undone. This will permanently delete your note"
        itemName={noteTitle}
        isDeleting={isDeleting}
      />
    </div>
  );
}
