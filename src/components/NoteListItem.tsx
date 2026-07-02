"use client";

import { memo, useMemo, useState } from "react";
import { ClockIcon, Trash2Icon, Sparkles, BookOpen, MoreVertical, Copy, Pin, Tag, Paperclip, ChevronRight } from "lucide-react";
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

interface NoteListItemProps {
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
    onDelete?: (id: string) => void;
}

function NoteListItem({
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
}: NoteListItemProps) {
    const router = useRouter();
    const [showUpdatedTime, setShowUpdatedTime] = useState(false);

    // Calculate reading time
    const readingStats = useMemo(() => {
        const text = contentText || "";
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));
        return { wordCount, readingTime };
    }, [contentText]);

    const handleClick = () => {
        router.push(`/notes/${id}`);
    };

    // Only navigate when the row itself is the keydown target, so activating the
    // inner time-toggle/dropdown buttons via keyboard doesn't also navigate.
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

    return (
        <div
            className={cn(
                "group flex items-center gap-4 px-4 py-3 cursor-pointer",
                "border-b border-border/50 last:border-b-0",
                "transition-all duration-200 ease-out",
                "hover:bg-muted/50",
                isPinned && "bg-primary/5",
                "motion-reduce:transition-none"
            )}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`Open note: ${title}${isPinned ? " (pinned)" : ""}`}
        >
            {/* Pin indicator */}
            {isPinned && (
                <div className="shrink-0">
                    <Pin size={14} className="text-primary fill-primary" />
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0 flex items-center gap-4">
                {/* Title and preview */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm truncate">
                            {title || "Untitled Note"}
                        </h3>
                        {summary && (
                            <Sparkles size={12} className="text-primary shrink-0" />
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {truncateText(summary || contentText || "No content", 80)}
                    </p>
                </div>

                {/* Tags */}
                <div className="hidden md:flex items-center gap-1.5 shrink-0 max-w-[200px]">
                    {tags?.slice(0, 2).map((tag) => (
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
                    {tags && tags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
                    )}
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1">
                        <BookOpen size={11} />
                        {readingStats.wordCount}w
                    </span>
                    {!!attachmentCount && attachmentCount > 0 && (
                        <span className="flex items-center gap-1 text-primary/70">
                            <Paperclip size={11} />
                            {attachmentCount}
                        </span>
                    )}
                </div>

                {/* Time */}
                <button
                    onClick={toggleTimeDisplay}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 min-w-[80px]"
                    title={`Click to toggle. ${displayTime.toLocaleString()}`}
                    aria-label={`${timeLabel} ${displayTime.toLocaleString()}. Click to toggle between created and updated time.`}
                >
                    <ClockIcon size={11} />
                    <span>{getRelativeTime(displayTime)}</span>
                </button>
            </div>

            {/* Actions — faintly visible at rest so they're discoverable and
                reachable on touch; full opacity on hover/focus. */}
            <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="More options"
                            aria-label="More options"
                        >
                            <MoreVertical size={14} />
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
                <ChevronRight size={14} className="text-muted-foreground/50" />
            </div>
        </div>
    );
}

export default memo(NoteListItem);
