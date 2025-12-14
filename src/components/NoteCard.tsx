"use client";

import { useMemo, useState } from "react";
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
import { Badge } from "./ui/badge";
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
  createdAt: Date;
  updatedAt?: Date;
  isPinned?: boolean;
  attachmentCount?: number;
  onPin?: (id: string, isPinned: boolean) => void;
}

export default function NotesCard({
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    await navigator.clipboard.writeText(contentText || "");
  };

  const toggleTimeDisplay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowUpdatedTime(!showUpdatedTime);
  };

  const displayTime = showUpdatedTime && updatedAt ? updatedAt : createdAt;
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
        "transition-all duration-300 ease-out",
        "hover:shadow-xl hover:-translate-y-1",
        // Border styling with gradient on hover
        "border-border/50 hover:border-primary/30",
        "bg-card/80 backdrop-blur-sm hover:bg-card",
        // Pinned state
        isPinned && "ring-2 ring-primary/20 border-primary/40",
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
        <div className="absolute top-2 left-2 z-10">
          <Pin size={14} className="text-primary fill-primary" />
        </div>
      )}

      {/* Actions - Delete button and context menu */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-10">
        {/* Context Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full touch-manipulation"
              title="More options"
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
            className="flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-muted-foreground transition-colors"
            title={`Click to toggle. ${displayTime.toLocaleString()}`}
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
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={cn(
                    "text-[10px] px-2 py-0.5 h-5 font-medium",
                    "border-transparent transition-colors",
                    "bg-secondary/50 text-secondary-foreground hover:bg-secondary/80"
                  )}
                  style={tag.color ? {
                    backgroundColor: `${tag.color}15`,
                    color: tag.color,
                    borderColor: `${tag.color}30`
                  } : undefined}
                >
                  {tag.name}
                </Badge>
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
            {attachmentCount && attachmentCount > 0 && (
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
