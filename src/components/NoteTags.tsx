"use client";

import { useState } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Tag, TagInput } from "@/components/TagInput";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface NoteTagsProps {
    tags: Tag[];
    onChange: (tags: Tag[]) => void;
    className?: string;
}

export function NoteTags({ tags, onChange, className }: NoteTagsProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleAddTag = (tag: Tag | string) => {
        if (typeof tag === "string") {
            // New tag without ID/Color yet
            onChange([...tags, { id: `temp-${Date.now()}`, name: tag, color: null }]);
        } else {
            // Existing tag with color
            onChange([...tags, tag]);
        }
    };

    const handleRemoveTag = (tagNameToRemove: string) => {
        onChange(tags.filter((tag) => tag.name !== tagNameToRemove));
    };

    return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
            {tags.length === 0 && (
                <span className="text-sm text-muted-foreground italic flex items-center gap-2">
                    <TagIcon size={14} />
                    No tags
                </span>
            )}

            {tags.map((tag) => (
                <Badge
                    key={tag.id || tag.name}
                    variant="secondary"
                    className="pl-2 pr-1 py-1 h-7 text-sm transition-colors border"
                    style={{
                        backgroundColor: tag.color ? `${tag.color}20` : undefined,
                        borderColor: tag.color ? `${tag.color}40` : undefined,
                        color: tag.color ? tag.color : undefined,
                    }}
                >
                    {tag.id && !tag.id.startsWith("temp-") ? (
                        <Link href={`/tags?id=${tag.id}`} className="hover:underline">
                            {tag.name}
                        </Link>
                    ) : (
                        <span>{tag.name}</span>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering any parent clicks
                            handleRemoveTag(tag.name);
                        }}
                        className="ml-1 hover:bg-background/50 rounded-full p-0.5 transition-colors"
                    >
                        <Plus size={12} className="rotate-45" />
                        <span className="sr-only">Remove {tag.name}</span>
                    </button>
                </Badge>
            ))}

            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 px-2 text-muted-foreground hover:text-foreground",
                            tags.length === 0 && "text-primary font-medium bg-secondary/50 hover:bg-secondary"
                        )}
                    >
                        <Plus size={14} className="mr-1" />
                        Add Tag
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <div className="p-2">
                        <TagInput
                            value={tags.map(t => t.name)}
                            onChange={() => { }} // Handled by onAddTag/onRemoveTag
                            onAddTag={handleAddTag}
                            onRemoveTag={handleRemoveTag}
                            placeholder="Type to add..."
                            className="w-full"
                            showTags={false}
                            autoFocus
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
