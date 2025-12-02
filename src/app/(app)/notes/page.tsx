"use client";

import { useEffect, useState } from "react";
import { PlusSquareIcon, AlertCircleIcon } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import NotesCard from "@/components/NoteCard";
import AddNoteModal from "@/components/AddNoteModal";
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

const NotesArea = ({ notes, onDelete }: { notes: Note[]; onDelete: (id: string) => void }) => {
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
      {notes.map(({ id, title, contentText, createdAt, tags }) => (
        <NotesCard
          key={id}
          title={title}
          contentText={
            typeof contentText === "string"
              ? contentText
              : JSON.stringify(contentText)
          }
          createdAt={new Date(createdAt)}
          id={id}
          tags={tags}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default function NotesPage() {
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const { notes, isLoading, error, refetch } = useNotes();
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
    <div className="">
      <Topbar>
        <div className="p-2 text-lg font-semibold">Notes</div>
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
      {!isLoading && !error && <NotesArea notes={notes} onDelete={handleDeleteRequest} />}

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
