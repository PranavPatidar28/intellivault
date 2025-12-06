"use client";

import { ClockIcon, Trash2Icon, Sparkles } from "lucide-react";
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

interface NoteCardProps {
  id: string;
  title: string;
  contentText: string;
  summary?: string | null;
  tags?: { id: string; name: string; color: string | null }[];
  createdAt: Date;
}

export default function NotesCard({
  id,
  title,
  contentText,
  summary,
  tags,
  createdAt,
  onDelete,
}: NoteCardProps & { onDelete?: (id: string) => void }) {
  const router = useRouter();

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

  return (
    <Card
      className="group relative flex flex-col cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-border/50 hover:border-primary/50 bg-card/50 hover:bg-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Open note: ${title}`}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
          onClick={handleDelete}
          title="Delete note"
        >
          <Trash2Icon size={16} />
        </Button>
      </div>
      <CardHeader className="pb-2 space-y-1">
        <CardTitle className="line-clamp-1 text-lg font-semibold pr-8 tracking-tight">{title || "Untitled Note"}</CardTitle>
        <CardDescription>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
            <ClockIcon size={12} />
            <span title={createdAt.toLocaleString()}>
              {getRelativeTime(createdAt)}
            </span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="relative">
          {summary && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium mb-1">
              <Sparkles size={10} />
              AI Summary
            </span>
          )}
          <p className="text-sm text-muted-foreground/90 line-clamp-4 leading-relaxed">
            {truncateText(summary || contentText || "No content", 150)}
          </p>
        </div>
        {tags && tags.length > 0 && (
          <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-[10px] px-2 py-0.5 h-5 font-medium border-transparent bg-secondary/50 text-secondary-foreground hover:bg-secondary/80 transition-colors"
                style={tag.color ? {
                  backgroundColor: `${tag.color}15`,
                  color: tag.color,
                  borderColor: `${tag.color}30`
                } : undefined}
              >
                {tag.name}
              </Badge>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground font-medium flex items-center px-1">+{tags.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
