"use client";

import { memo, useMemo, useState } from "react";
import { ClockIcon, Trash2Icon, Sparkles, BookOpen, MoreVertical, Copy, Pin, Tag, Share2, Paperclip } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { getRelativeTime, truncateText } from "@/lib/utils/text";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NoteCardProps {
  id: string;
  title: string;
  contentText: string;
  summary?: string | null;
  tags?: { id: string; name: string; color: string | null }[];
  createdAt: Date | string;
  updatedAt?: Date | string;
  isPinned?: boolean;
  attachmentCount?: number;
  onPin?: (id: string, isPinned: boolean) => void;
}

function NotesCard({
  id,
  title,
  contentText,
  summary,
  tags,
  createdAt,
  updatedAt,
  isPinned,
  attachmentCount,
  onDelete,
  onPin,
}: NoteCardProps & { onDelete?: (id: string) => void }) {
  const router = useRouter();
  const [showUpdatedTime, setShowUpdatedTime] = useState(false);

  // Calculate reading time
  const readingStats = useMemo(() => {
    const text = contentText || "";
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // ~200 words per minute
    return { wordCount, readingTime };
  }, [contentText]);

  const handleClick = () => {
    router.push(`/notes/${id}`);
  };

  // Only navigate when the card itself is the keydown target. Inner controls
  // (time toggle, dropdown trigger) are real buttons; their Enter/Space presses
  // bubble here, so without this guard activating them would also navigate.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/notes/${id}`);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(id);
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(contentText || "");
      toast.success("Content copied to clipboard");
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const toggleTimeDisplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUpdatedTime(!showUpdatedTime);
  };

  const displayTime = showUpdatedTime && updatedAt ? new Date(updatedAt) : new Date(createdAt);
  const timeLabel = showUpdatedTime && updatedAt ? "Updated" : "Created";

  // Responsive tag count: show 2 on mobile, 3 on larger screens
  const visibleTagCount = 3;

  return (
    <Card
      className={cn(
        // Base styles
        "group relative flex flex-col cursor-pointer",
        // Responsive padding
        "min-h-[180px] sm:min-h-[200px]",
        // Animations & transitions
        "transition-all duration-200 ease-out",
        "hover:shadow-md hover:-translate-y-0.5",
        // Border styling
        "hover:border-ring/40",
        // Pinned state
        isPinned && "ring-1 ring-primary/30 border-primary/40 bg-primary/[0.03]",
        // Reduced motion support
        "motion-reduce:transition-none motion-reduce:hover:transform-none"
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open note: ${title}${isPinned ? " (pinned)" : ""}`}
    >
      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute top-2.5 left-2.5 z-10">
          <Pin size={14} className="text-primary fill-primary" />
        </div>
      )}

      {/* Actions - context menu. Kept faintly visible at rest (not hover-only)
          so the menu is discoverable and reachable on touch devices; lifts to
          full opacity on hover/focus. */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-10">
        {/* Context Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full touch-manipulation"
              title="More options"
              aria-label="More options"
            >
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={handleCopy}>
              <Copy size={14} className="mr-2" />
              Copy content
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onPin?.(id, !!isPinned);
              }}
            >
              <Pin size={14} className="mr-2" />
              {isPinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Tag size={14} className="mr-2" />
              Manage tags
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Share2 size={14} className="mr-2" />
              Share
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2Icon size={14} className="mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardHeader className={cn(
        "pb-2 space-y-1",
        isPinned && "pl-8" // Make room for pin icon
      )}>
        <CardTitle className="line-clamp-1 text-base sm:text-lg font-semibold pr-16 tracking-tight">
          {title || "Untitled Note"}
        </CardTitle>
        <CardDescription>
          <button
            onClick={toggleTimeDisplay}
            onKeyDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-muted-foreground transition-colors"
            title={`Click to toggle. ${displayTime.toLocaleString()}`}
            aria-label={`${timeLabel} ${displayTime.toLocaleString()}. Click to toggle between created and updated time.`}
          >
            <ClockIcon size={12} />
            <span>
              {timeLabel} {getRelativeTime(displayTime)}
            </span>
          </button>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 sm:gap-4 pb-4">
        {/* Content Preview */}
        <div className="relative flex-1">
          {summary && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium mb-1">
              <Sparkles size={10} className="animate-pulse" />
              AI Summary
            </span>
          )}
          <p className="text-sm text-muted-foreground/90 line-clamp-3 sm:line-clamp-4 leading-relaxed">
            {truncateText(summary || contentText || "No content", 150)}
          </p>
        </div>

        {/* Footer: Tags + Reading Stats */}
        <div className="mt-auto flex flex-col gap-2">
          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, visibleTagCount).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                >
                  <span
                    className="size-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                    style={{ backgroundColor: tag.color || "var(--muted-foreground)" }}
                    aria-hidden="true"
                  />
                  {tag.name}
                </span>
              ))}
              {tags.length > visibleTagCount && (
                <span className="text-[10px] text-muted-foreground font-medium flex items-center px-1">
                  +{tags.length - visibleTagCount}
                </span>
              )}
            </div>
          )}

          {/* Reading stats + media indicator - hidden on very small screens */}
          <div className="hidden xs:flex items-center gap-2 text-[10px] text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <BookOpen size={10} />
              {readingStats.wordCount} words
            </span>
            <span>•</span>
            <span>{readingStats.readingTime} min read</span>
            {!!attachmentCount && attachmentCount > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-primary/70">
                  <Paperclip size={10} />
                  {attachmentCount}
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(NotesCard);
