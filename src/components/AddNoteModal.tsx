"use client";

import { FullscreenIcon, XIcon, AlertCircleIcon, CheckCircleIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
} from "./ui/card";
import {
  SimpleEditor,
  SimpleEditorRef,
} from "./tiptap-templates/simple/simple-editor";
import React, { useRef, useState, useEffect } from "react";
import { Input } from "./ui/input";
import { TagInput } from "./TagInput";

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
  const noteTitleRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<SimpleEditorRef>(null);

  // Focus title input when modal opens
  useEffect(() => {
    if (isAddNoteModalOpen && noteTitleRef.current) {
      setTimeout(() => noteTitleRef.current?.focus(), 100);
    }
  }, [isAddNoteModalOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc to close
      if (e.key === "Escape") {
        setIsAddNoteModalOpen(false);
      }
      // Ctrl+Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSaveNote();
      }
    };

    if (isAddNoteModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isAddNoteModalOpen]);

  const handleSaveNote = async () => {
    if (!editorRef.current || !noteTitleRef.current) return;

    const title = noteTitleRef.current.value.trim();
    const contentJSON = editorRef.current.getJSON();
    const contentText = editorRef.current.getText();

    // Validation
    setError(null);

    if (!title) {
      setError("Please enter a title for your note");
      noteTitleRef.current?.focus();
      return;
    }

    if (title.length > 200) {
      setError("Title is too long (maximum 200 characters)");
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
        // Show success state briefly
        setShowSuccess(true);

        // Reset form
        if (noteTitleRef.current) noteTitleRef.current.value = "";
        setTags([]);

        // Call callback and close modal after brief delay
        setTimeout(() => {
          onNoteCreated?.();
          setIsAddNoteModalOpen(false);
          setShowSuccess(false);
        }, 500);
      } else {
        setError(data.error || "Failed to save note. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setIsAddNoteModalOpen(false);
      setError(null);
      setShowSuccess(false);
      setTags([]);
    }
  };

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <Card
        className={`relative z-20 bg-accent flex flex-col transition-all duration-300 ease-in-out ${isFullScreen ? "h-screen w-screen" : "h-8/10 w-2/3"
          }`}
      >
        <CardHeader className="shrink-0">
          <div className="space-y-2">
            <Input
              placeholder="Untitled Note"
              ref={noteTitleRef}
              className="text-lg font-semibold border-none shadow-none h-auto focus-visible:ring-0 p-2"
              maxLength={200}
              disabled={isSaving}
            />
            <div className="px-2">
              <TagInput value={tags} onChange={setTags} placeholder="Add tags..." />
            </div>
          </div>
          <CardAction>
            <Button
              variant="ghost"
              onClick={() => setIsFullScreen((value) => !value)}
              disabled={isSaving}
            >
              <FullscreenIcon />
            </Button>
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isSaving}
            >
              <XIcon />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 min-h-0 pb-4">
          <SimpleEditor ref={editorRef} />
        </CardContent>

        <CardFooter className="flex flex-col items-end gap-2">
          {/* Error message */}
          {error && (
            <div className="w-full flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircleIcon size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Success message */}
          {showSuccess && (
            <div className="w-full flex items-center gap-2 text-sm text-green-600 bg-green-600/10 p-3 rounded-md">
              <CheckCircleIcon size={16} />
              <span>Note created successfully!</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                "Add Note"
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
