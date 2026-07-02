"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, FileText, Loader2, Tag, Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface QuickCaptureCardProps {
  availableTags: { id: string; name: string; color: string | null }[];
  onSuccess?: () => void;
}

export function QuickCaptureCard({ availableTags, onSuccess }: QuickCaptureCardProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagText, setNewTagText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isProcessingAIDump, setIsProcessingAIDump] = useState(false);
  const [localTags, setLocalTags] = useState(availableTags);

  const handleToggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleAddNewTag = () => {
    const trimmed = newTagText.trim();
    if (!trimmed) return;
    if (localTags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      if (!selectedTags.includes(trimmed)) {
        setSelectedTags((prev) => [...prev, trimmed]);
      }
    } else {
      const newTag = { id: `temp-${Date.now()}`, name: trimmed, color: null };
      setLocalTags((prev) => [...prev, newTag]);
      setSelectedTags((prev) => [...prev, trimmed]);
    }
    setNewTagText("");
  };

  const handleRemoveSelectedTag = (tagName: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tagName));
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSelectedTags([]);
  };

  const handleSaveNote = async () => {
    if (!content.trim()) {
      toast.error("Please enter some content for your note");
      return;
    }

    setIsSavingNote(true);
    try {
      const finalTitle = title.trim() || `Quick Note - ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          contentText: content,
          tags: selectedTags,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Note saved successfully");
        resetForm();
        router.refresh();
        onSuccess?.();
      } else {
        toast.error(data.error || "Failed to save note");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while saving the note");
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleSaveAIDump = async () => {
    if (!content.trim()) {
      toast.error("Please enter some content to dump");
      return;
    }

    setIsProcessingAIDump(true);
    try {
      const response = await fetch("/api/ai-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content,
          source: "paste",
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Braindump sent to AI Dump pipeline!");
        resetForm();
        router.refresh();
        onSuccess?.();
      } else {
        toast.error(data.error || "Failed to process braindump");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while processing the braindump");
    } finally {
      setIsProcessingAIDump(false);
    }
  };

  const isDisabled = !content.trim() || isSavingNote || isProcessingAIDump;

  return (
    <Card className="relative overflow-hidden border-border/50 bg-card/60 shadow-md backdrop-blur-md transition-shadow hover:shadow-lg">
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 -z-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          Quick Capture
        </CardTitle>
        <CardDescription>
          Instantly capture a thought or dump raw ideas to let the AI structure it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSavingNote || isProcessingAIDump}
            className="border-border/40 bg-background/50 focus-visible:ring-primary/40"
          />
          <textarea
            placeholder="Start typing your thought, copy a code block, or drop a raw braindump here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSavingNote || isProcessingAIDump}
            rows={4}
            className="w-full rounded-md border border-border/40 bg-background/50 p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Selected tags row */}
        <div className="flex flex-wrap items-center gap-1.5 min-h-[24px]">
          <AnimatePresence>
            {selectedTags.map((tag) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveSelectedTag(tag)}
                  className="rounded-full hover:bg-primary/20 p-0.5"
                >
                  <X className="size-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>

          {/* Tags Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 rounded-full border border-dashed border-border/60 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                disabled={isSavingNote || isProcessingAIDump}
              >
                <Tag className="mr-1 size-3.5" />
                Tags
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-2">
              <div className="space-y-2">
                <div className="flex items-center gap-1 border-b border-border/40 pb-2">
                  <Input
                    placeholder="New tag..."
                    value={newTagText}
                    onChange={(e) => setNewTagText(e.target.value)}
                    className="h-7 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewTag();
                      }
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddNewTag}>
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 py-1">
                  {localTags.length === 0 ? (
                    <p className="text-[10px] text-center text-muted-foreground py-2">No tags yet</p>
                  ) : (
                    localTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.name);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => handleToggleTag(tag.name)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-sm px-2 py-1 text-xs hover:bg-accent text-left",
                            isSelected && "text-primary font-medium"
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-1.5 rounded-full"
                              style={{
                                backgroundColor: tag.color || "var(--muted-foreground)",
                              }}
                            />
                            {tag.name}
                          </span>
                          {isSelected && <Check className="size-3.5" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 border-t border-border/40 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveNote}
            disabled={isDisabled}
            className="relative h-9 border-border/50 w-full sm:w-auto"
          >
            {isSavingNote ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FileText className="mr-1.5 size-3.5" />
                Save Note
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAIDump}
            disabled={isDisabled}
            className="relative h-9 bg-primary/95 text-primary-foreground hover:bg-primary shadow-xs w-full sm:w-auto"
          >
            {isProcessingAIDump ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 size-3.5" />
                AI Dump
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
