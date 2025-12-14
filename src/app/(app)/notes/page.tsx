"use client";

import { useEffect, useState } from "react";
import { PlusSquareIcon, AlertCircleIcon } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import NotesCard from "@/components/NoteCard";
import AddNoteModal from "@/components/AddNoteModal";
import { NoteSearch } from "@/components/NoteSearch";
import { useNotes } from "@/hooks/use-notes";
import { Note } from "@/types/note";
import { NoteListSkeleton } from "@/components/skeletons/note-skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NotesArea = ({ notes, onDelete, onPin }: {
  notes: Note[];
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
}) => {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <div className="rounded-full bg-muted p-6 mb-4">
          <PlusSquareIcon size={48} className="text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No notes yet</h3>
        <p className="text-muted-foreground max-w-sm">
          Get started by creating your first note. Click the &quot;Add Note&quot; button above to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {notes.map(({ id, title, contentText, summary, createdAt, updatedAt, isPinned, attachmentCount, tags }) => (
        <NotesCard
          key={id}
          title={title}
          contentText={
            typeof contentText === "string"
              ? contentText
              : JSON.stringify(contentText)
          }
          summary={summary}
          createdAt={new Date(createdAt)}
          updatedAt={updatedAt ? new Date(updatedAt) : undefined}
          id={id}
          tags={tags}
          isPinned={isPinned}
          attachmentCount={attachmentCount}
          onDelete={onDelete}
          onPin={onPin}
        />
      ))}
    </div>
  );
};

export default function NotesPage() {
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const { notes, isLoading, error, refetch, optimisticTogglePin } = useNotes();
  const { toast } = useToast();

  const handleDeleteRequest = (id: string) => {
    setNoteToDelete(id);
  };

  const confirmDelete = async () => {
    if (!noteToDelete) return;

    try {
      const response = await fetch(`/api/notes/${noteToDelete}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Note deleted",
          description: "The note has been successfully deleted.",
        });
        refetch();
      } else {
        throw new Error("Failed to delete note");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setNoteToDelete(null);
    }
  };

  const handlePin = async (id: string, currentlyPinned: boolean) => {
    // Optimistic update - UI changes instantly
    optimisticTogglePin(id);

    // Show toast immediately
    toast({
      title: currentlyPinned ? "Note unpinned" : "Note pinned",
      description: currentlyPinned
        ? "Note removed from pinned section."
        : "Note will now appear at the top.",
    });

    // API call in background - revert if fails
    try {
      const response = await fetch(`/api/notes/${id}/pin`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to update pin status");
      }
    } catch {
      // Revert the optimistic update
      optimisticTogglePin(id);
      toast({
        title: "Error",
        description: "Failed to update pin status. Reverted change.",
        variant: "destructive",
      });
    }
  };

  // Keyboard shortcut (Ctrl/Cmd + N for new note)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setIsAddNoteModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <Topbar className="flex-shrink-0">
        <div className="flex items-center gap-6 flex-1">
          <div className="p-2 text-lg font-semibold min-w-fit">Notes</div>
          <div className="w-full max-w-xl">
            <NoteSearch />
          </div>
        </div>
        <div>
          <Button onClick={() => setIsAddNoteModalOpen(true)}>
            <PlusSquareIcon size={16} className="mr-2" />
            Add Note
          </Button>
        </div>
      </Topbar>

      {/* Add Note Modal */}
      {isAddNoteModalOpen && (
        <AddNoteModal
          isAddNoteModalOpen={isAddNoteModalOpen}
          setIsAddNoteModalOpen={setIsAddNoteModalOpen}
          onNoteCreated={refetch}
        />
      )}

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading State */}
        {isLoading && <NoteListSkeleton />}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-4">
            <div className="flex flex-col items-center justify-center p-8 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircleIcon size={48} className="text-destructive mb-4" />
              <h3 className="text-lg font-semibold text-destructive mb-2">
                Failed to load notes
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md text-center">
                {error}
              </p>
              <Button onClick={refetch} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Success State */}
        {!isLoading && !error && <NotesArea notes={notes} onDelete={handleDeleteRequest} onPin={handlePin} />}
      </div>

      <Dialog open={!!noteToDelete} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
