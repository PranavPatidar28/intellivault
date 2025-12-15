"use client";

import { useMemo, useState } from "react";
import { ClockIcon, Trash2Icon, Sparkles, BookOpen, MoreVertical, Copy, Pin, Tag, Paperclip, ChevronRight } from "lucide-react";
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

interface NoteListItemProps {
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
    onDelete?: (id: string) => void;
}

export default function NoteListItem({
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
                        <Badge
                            key={tag.id}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 font-medium border-transparent bg-secondary/50"
                            style={tag.color ? {
                                backgroundColor: `${tag.color}15`,
                                color: tag.color,
                            } : undefined}
                        >
                            {tag.name}
                        </Badge>
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
                    {attachmentCount && attachmentCount > 0 && (
                        <span className="flex items-center gap-1 text-primary/70">
                            <Paperclip size={11} />
                            {attachmentCount}
                        </span>
                    )}
                </div>

                {/* Time */}
                <button
                    onClick={toggleTimeDisplay}
                    className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0 min-w-[80px]"
                    title={`Click to toggle. ${displayTime.toLocaleString()}`}
                >
                    <ClockIcon size={11} />
                    <span>{getRelativeTime(displayTime)}</span>
                </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
