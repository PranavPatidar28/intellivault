"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { PlusSquareIcon, AlertCircleIcon, LayoutGrid, List, ArrowUpDown, Filter, Loader2 } from "lucide-react";
import { Topbar } from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import NotesCard from "@/components/NoteCard";
import NoteListItem from "@/components/NoteListItem";
import AddNoteModal from "@/components/AddNoteModal";
import { NoteSearch } from "@/components/NoteSearch";
import { useNotes } from "@/hooks/use-notes";
import { Note } from "@/types/note";
import { NoteListSkeleton } from "@/components/skeletons/note-skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePreferences } from "@/components/PreferencesProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ViewMode = "grid" | "list";
type SortOption = "updatedAt" | "createdAt" | "title" | "title-desc";

const VIEW_MODE_KEY = "intellivault_notes_view_mode";
const SORT_KEY = "intellivault_notes_sort";
const FILTER_TAGS_KEY = "intellivault_notes_filter_tags";

const NotesGrid = ({ notes, onDelete, onPin }: {
  notes: Note[];
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
}) => (
  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {notes.map(({ id, title, contentText, summary, createdAt, updatedAt, isPinned, attachmentCount, tags }) => (
      <NotesCard
        key={id}
        id={id}
        title={title}
        contentText={typeof contentText === "string" ? contentText : JSON.stringify(contentText)}
        summary={summary}
        createdAt={createdAt}
        updatedAt={updatedAt}
        tags={tags}
        isPinned={isPinned}
        attachmentCount={attachmentCount}
        onDelete={onDelete}
        onPin={onPin}
      />
    ))}
  </div>
);

const NotesList = ({ notes, onDelete, onPin }: {
  notes: Note[];
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
}) => (
  <div className="border rounded-xl mx-4 my-4 bg-card shadow-sm overflow-hidden">
    {notes.map(({ id, title, contentText, summary, createdAt, updatedAt, isPinned, attachmentCount, tags }) => (
      <NoteListItem
        key={id}
        id={id}
        title={title}
        contentText={typeof contentText === "string" ? contentText : JSON.stringify(contentText)}
        summary={summary}
        createdAt={createdAt}
        updatedAt={updatedAt}
        tags={tags}
        isPinned={isPinned}
        attachmentCount={attachmentCount}
        onDelete={onDelete}
        onPin={onPin}
      />
    ))}
  </div>
);

const NotesArea = ({ notes, onDelete, onPin, viewMode, hasFilters }: {
  notes: Note[];
  onDelete: (id: string) => void;
  onPin: (id: string, isPinned: boolean) => void;
  viewMode: ViewMode;
  hasFilters?: boolean;
}) => {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5">
          {hasFilters ? (
            <Filter size={28} />
          ) : (
            <PlusSquareIcon size={28} />
          )}
        </span>
        <h3 className="text-xl font-semibold mb-1.5">
          {hasFilters ? "No matching notes" : "No notes yet"}
        </h3>
        <p className="text-muted-foreground max-w-sm">
          {hasFilters
            ? "Try adjusting your filters or clear them to see all notes."
            : 'Get started by creating your first note. Click the "Add Note" button above to begin.'}
        </p>
      </div>
    );
  }

  return viewMode === "grid"
    ? <NotesGrid notes={notes} onDelete={onDelete} onPin={onPin} />
    : <NotesList notes={notes} onDelete={onDelete} onPin={onPin} />;
};

export default function NotesPage() {
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("updatedAt");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    notes,
    isLoading,
    isLoadingMore,
    error,
    total,
    hasMore,
    refetch,
    loadMore,
    optimisticTogglePin,
    optimisticRemoveNote,
    restoreNote,
  } = useNotes();
  const { toast } = useToast();
  const { preferences } = usePreferences();
  const hasAppliedPreferences = useRef(false);

  // Load preferences - use user preferences as defaults, with localStorage override
  useEffect(() => {
    // Apply user preferences only once when they load
    if (preferences && !hasAppliedPreferences.current) {
      const savedViewMode = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
      const savedSort = localStorage.getItem(SORT_KEY) as SortOption | null;

      // Use localStorage if available, otherwise use preferences
      setViewMode(savedViewMode || (preferences.defaultNoteView as ViewMode) || "grid");
      setSortBy(savedSort || (preferences.defaultSortOrder as SortOption) || "updatedAt");
      hasAppliedPreferences.current = true;
    }

    // Always load filter tags from localStorage
    const savedFilterTags = localStorage.getItem(FILTER_TAGS_KEY);
    if (savedFilterTags) {
      try {
        setFilterTags(JSON.parse(savedFilterTags));
      } catch { }
    }
  }, [preferences]);

  // Save preferences to localStorage
  const handleViewModeChange = (value: string) => {
    if (value === "grid" || value === "list") {
      setViewMode(value);
      localStorage.setItem(VIEW_MODE_KEY, value);
    }
  };

  const handleSortChange = (value: SortOption) => {
    setSortBy(value);
    localStorage.setItem(SORT_KEY, value);
  };

  const handleFilterTagToggle = (tagName: string) => {
    setFilterTags(prev => {
      const newTags = prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName];
      localStorage.setItem(FILTER_TAGS_KEY, JSON.stringify(newTags));
      return newTags;
    });
  };

  const clearFilterTags = () => {
    setFilterTags([]);
    localStorage.removeItem(FILTER_TAGS_KEY);
  };

  // Extract unique tags from all notes
  const availableTags = useMemo(() => {
    if (!notes) return [];
    const tagMap = new Map<string, { id: string; name: string; color: string | null; count: number }>();
    notes.forEach(note => {
      note.tags?.forEach(tag => {
        const existing = tagMap.get(tag.name);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(tag.name, { ...tag, count: 1 });
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => b.count - a.count);
  }, [notes]);

  // Filter and sort notes
  const filteredAndSortedNotes = useMemo(() => {
    if (!notes) return [];

    // First filter by tags
    let filtered = notes;
    if (filterTags.length > 0) {
      filtered = notes.filter(note =>
        filterTags.some(tagName =>
          note.tags?.some(t => t.name === tagName)
        )
      );
    }

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      // Always keep pinned notes at top
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // Within the pinned group, order by most-recently-pinned first so a
      // just-pinned note jumps to the top (matches the "appear at the top" toast
      // and the optimistic hook behavior).
      if (a.isPinned && b.isPinned) {
        const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
        const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
      }

      // Then sort by selected option
      switch (sortBy) {
        case "updatedAt":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "createdAt":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return sorted;
  }, [notes, sortBy, filterTags]);

  const handleDeleteRequest = useCallback((id: string) => {
    setNoteToDelete(id);
  }, []);

  const confirmDelete = async () => {
    if (!noteToDelete || isDeleting) return;

    // Capture the note + its position before removing, so we can restore on failure.
    const removalIndex = notes.findIndex((n) => n.id === noteToDelete);
    setIsDeleting(true);

    // Optimistically remove from the list so it disappears in place (no full
    // skeleton flash, scroll position preserved).
    const removed = optimisticRemoveNote(noteToDelete);
    const id = noteToDelete;
    setNoteToDelete(null);

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast({
          title: "Note deleted",
          description: "The note has been successfully deleted.",
        });
      } else {
        throw new Error("Failed to delete note");
      }
    } catch {
      // Restore the note to its original position on failure.
      if (removed) restoreNote(removed, removalIndex);
      toast({
        title: "Error",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePin = useCallback(async (id: string, currentlyPinned: boolean) => {
    optimisticTogglePin(id);

    toast({
      title: currentlyPinned ? "Note unpinned" : "Note pinned",
      description: currentlyPinned
        ? "Note removed from pinned section."
        : "Note will now appear at the top.",
    });

    try {
      const response = await fetch(`/api/notes/${id}/pin`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to update pin status");
      }
    } catch {
      optimisticTogglePin(id);
      toast({
        title: "Error",
        description: "Failed to update pin status. Reverted change.",
        variant: "destructive",
      });
    }
  }, [optimisticTogglePin, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setIsAddNoteModalOpen(true);
      }
      // Toggle view mode with Ctrl+Shift+V
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "V") {
        e.preventDefault();
        const newMode = viewMode === "grid" ? "list" : "grid";
        handleViewModeChange(newMode);
        toast({
          title: `Switched to ${newMode} view`,
          description: `Notes are now displayed in ${newMode} mode.`,
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, toast]);

  return (
    <div className="h-full flex flex-col">
      <Topbar className="flex-shrink-0">
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2 text-lg font-semibold min-w-fit">Notes</div>
          <div className="w-full max-w-xl">
            <NoteSearch />
          </div>
        </div>

        {/* View controls */}
        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[140px] h-9">
              <ArrowUpDown size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">Last Modified</SelectItem>
              <SelectItem value="createdAt">Date Created</SelectItem>
              <SelectItem value="title">Title A-Z</SelectItem>
              <SelectItem value="title-desc">Title Z-A</SelectItem>
            </SelectContent>
          </Select>

          {/* Tag filter */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Filter size={14} />
                <span className="hidden sm:inline">Filter</span>
                {filterTags.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {filterTags.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="end">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Filter by Tags</span>
                  {filterTags.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={clearFilterTags}
                    >
                      Clear all
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto p-2">
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tags available
                  </p>
                ) : (
                  <div className="space-y-1">
                    {availableTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={filterTags.includes(tag.name)}
                          onCheckedChange={() => handleFilterTagToggle(tag.name)}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                          style={{ backgroundColor: tag.color || "var(--muted-foreground)" }}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-sm truncate">
                          {tag.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {tag.count}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          {/* View mode toggle */}
          <TooltipProvider>
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={handleViewModeChange}
              className="border rounded-md"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="grid" aria-label="Grid view" className="h-9 w-9 p-0">
                    <LayoutGrid size={16} />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>Grid view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value="list" aria-label="List view" className="h-9 w-9 p-0">
                    <List size={16} />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent>List view (Ctrl+Shift+V)</TooltipContent>
              </Tooltip>
            </ToggleGroup>
          </TooltipProvider>

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
          onNoteCreated={() => refetch({ silent: true })}
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
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Success State */}
        {!isLoading && !error && (
          <>
            <NotesArea
              notes={filteredAndSortedNotes}
              onDelete={handleDeleteRequest}
              onPin={handlePin}
              viewMode={viewMode}
              hasFilters={filterTags.length > 0}
            />

            {/* Pagination: showing X of N + Load more */}
            {total > 0 && notes.length > 0 && (
              <div className="flex flex-col items-center gap-3 px-4 pb-8 pt-2">
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  Showing {notes.length} of {total} {total === 1 ? "note" : "notes"}
                </p>
                {hasMore && (
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="min-w-[140px]"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Loading
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!noteToDelete} onOpenChange={(open) => !open && !isDeleting && setNoteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteToDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Deleting
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
