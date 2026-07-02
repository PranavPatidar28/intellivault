"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pin, Trash2, FileText, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRelativeTime, truncateText } from "@/lib/utils/text";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface NoteItem {
  id: string;
  title: string;
  generatedTitle?: string | null;
  contentText: string;
  updatedAt: Date | string;
  isPinned: boolean;
  tags?: { id: string; name: string; color: string | null }[];
}

interface DashboardRecentNotesProps {
  initialNotes: NoteItem[];
  onActionSuccess?: () => void;
}

export function DashboardRecentNotes({ initialNotes, onActionSuccess }: DashboardRecentNotesProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [loadingNotes, setLoadingNotes] = useState<Record<string, boolean>>({});

  const handleTogglePin = async (e: React.MouseEvent, noteId: string, currentPinned: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    // Optimistic update
    setNotes((prev) =>
      prev
        .map((n) => (n.id === noteId ? { ...n, isPinned: !currentPinned } : n))
        // Re-sort: pinned first, then by date desc
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
    );

    try {
      const response = await fetch(`/api/notes/${noteId}/pin`, {
        method: "PATCH",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update pin state");
      }
      toast.success(currentPinned ? "Note unpinned" : "Note pinned to top");
      router.refresh();
      onActionSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to pin note. Reverting changes.");
      // Revert optimistic update
      setNotes(initialNotes);
    }
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this note?")) {
      return;
    }

    setLoadingNotes((prev) => ({ ...prev, [noteId]: true }));

    // Optimistic delete
    const previousNotes = [...notes];
    setNotes((prev) => prev.filter((n) => n.id !== noteId));

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to delete note");
      }
      toast.success("Note moved to trash");
      router.refresh();
      onActionSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete note. Reverting changes.");
      setNotes(previousNotes);
    } finally {
      setLoadingNotes((prev) => ({ ...prev, [noteId]: false }));
    }
  };

  return (
    <Card className="flex flex-col h-full border-border/50 bg-card/60 shadow-md backdrop-blur-md transition-shadow hover:shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        <CardDescription>Your latest vault actions & notes</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileText className="size-8 text-muted-foreground/50 mb-2 stroke-[1.5]" />
              <p className="text-sm text-muted-foreground">No recent notes found.</p>
            </div>
          ) : (
            <ul className="-mx-2 space-y-1.5 overflow-hidden">
              <AnimatePresence initial={false}>
                {notes.map((note) => {
                  const titleText =
                    note.title?.trim() ||
                    note.generatedTitle?.trim() ||
                    "Untitled note";
                  const snippet = truncateText(note.contentText || "", 85);
                  const isDeleting = loadingNotes[note.id];

                  return (
                    <motion.li
                      key={note.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "group relative rounded-lg px-3 py-2.5 transition-colors hover:bg-accent focus-within:bg-accent",
                        isDeleting && "opacity-50 pointer-events-none"
                      )}
                    >
                      <Link
                        href={`/notes/${note.id}`}
                        className="flex flex-col gap-1 focus-visible:outline-none"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={cn(
                                "flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary",
                                note.isPinned && "bg-primary/10 text-primary"
                              )}
                            >
                              <FileText className="size-3.5" />
                            </span>
                            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                              {titleText}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums mt-0.5">
                            {getRelativeTime(note.updatedAt)}
                          </span>
                        </div>

                        {snippet && (
                          <p className="pl-7 pr-6 text-xs text-muted-foreground/85 line-clamp-1">
                            {snippet}
                          </p>
                        )}

                        {note.tags && note.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pl-7 mt-1.5">
                            {note.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.25 text-[9px] font-medium text-secondary-foreground"
                              >
                                {tag.name}
                              </span>
                            ))}
                            {note.tags.length > 2 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{note.tags.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </Link>

                      {/* Hover action bar overlay */}
                      <div className="absolute right-2 top-2.5 hidden items-center gap-1 rounded-md bg-accent/95 pl-1.5 pr-1 py-1 group-hover:flex focus-within:flex">
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(e, note.id, note.isPinned)}
                          className={cn(
                            "rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors hover:text-primary",
                            note.isPinned && "text-primary"
                          )}
                          title={note.isPinned ? "Unpin note" : "Pin note"}
                        >
                          <Pin className="size-3.5 fill-current" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNote(e, note.id)}
                          className="rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors hover:text-destructive"
                          title="Delete note"
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="group mt-4 w-full justify-between border-t border-border/20 pt-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <Link href="/notes">
            View all notes
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
