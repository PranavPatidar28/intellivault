"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import {
    Pencil,
    Trash2,
    GitMerge,
    Clock,
    Calendar,
    FileText,
    Star,
    Archive,
    Tag as TagIcon,
    TrendingUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Tag {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    description?: string | null;
    isFavorite?: boolean;
    isArchived?: boolean;
    usageCount: number;
    lastUsed: Date;
    createdAt: Date;
    deletedAt: Date | null;
}

interface Note {
    id: string;
    title: string;
    contentText: string;
    createdAt: Date;
    updatedAt: Date;
}

interface RelatedTag {
    tag: Tag;
    strength: number;
}

interface TagInspectorProps {
    tag: Tag | null;
    topNotes: Note[];
    onRename: (name: string) => void;
    onRecolor: (color: string) => void;
    onDelete: () => void;
    onMerge: () => void;
    onRemoveNoteTag: (noteId: string) => void;
    onUpdateDescription?: (description: string) => void;
    onToggleFavorite?: () => void;
    onToggleArchive?: () => void;
}

export function TagInspector({
    tag,
    topNotes,
    onRename,
    onRecolor,
    onDelete,
    onMerge,
    onRemoveNoteTag,
    onUpdateDescription,
    onToggleFavorite,
    onToggleArchive,
}: TagInspectorProps) {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState("");
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editedDescription, setEditedDescription] = useState("");
    const [relatedTags, setRelatedTags] = useState<RelatedTag[]>([]);
    const [isLoadingRelated, setIsLoadingRelated] = useState(false);

    // Fetch related tags when tag changes
    useEffect(() => {
        if (!tag) return;

        const fetchRelatedTags = async () => {
            setIsLoadingRelated(true);
            try {
                const response = await fetch(`/api/tags/related/${tag.id}`);
                const data = await response.json();
                if (data.success) {
                    setRelatedTags(data.relatedTags || []);
                }
            } catch (error) {
                console.error("Failed to fetch related tags:", error);
            } finally {
                setIsLoadingRelated(false);
            }
        };

        fetchRelatedTags();
    }, [tag?.id]);

    if (!tag) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground">
                <p>Select a tag to view details</p>
            </div>
        );
    }

    const handleRename = () => {
        if (editedName.trim()) {
            onRename(editedName.trim());
            setIsEditingName(false);
            setEditedName("");
        }
    };

    const handleDescriptionSave = () => {
        if (onUpdateDescription) {
            onUpdateDescription(editedDescription.trim());
            setIsEditingDescription(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    {isEditingName ? (
                        <div className="flex gap-2">
                            <Input
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleRename();
                                    if (e.key === "Escape") {
                                        setIsEditingName(false);
                                        setEditedName("");
                                    }
                                }}
                                autoFocus
                                className="text-2xl font-bold"
                            />
                            <Button onClick={handleRename}>Save</Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsEditingName(false);
                                    setEditedName("");
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold">{tag.name}</h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setEditedName(tag.name);
                                    setIsEditingName(true);
                                }}
                            >
                                <Pencil size={16} />
                            </Button>
                            {onToggleFavorite && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onToggleFavorite}
                                    title={tag.isFavorite ? "Remove from favorites" : "Add to favorites"}
                                >
                                    <Star size={16} className={tag.isFavorite ? "fill-yellow-500 text-yellow-500" : ""} />
                                </Button>
                            )}
                            {onToggleArchive && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onToggleArchive}
                                    title={tag.isArchived ? "Unarchive" : "Archive"}
                                >
                                    <Archive size={16} className={tag.isArchived ? "text-orange-500" : ""} />
                                </Button>
                            )}
                        </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">/{tag.slug}</p>
                </div>

                <Badge
                    variant="secondary"
                    className="text-base px-4 py-2"
                    style={{
                        backgroundColor: tag.color || undefined,
                        color: tag.color ? "#fff" : undefined,
                    }}
                >
                    {tag.name}
                </Badge>
            </div>

            {/* Description */}
            <Card>
                <CardHeader>
                    <CardTitle>Description</CardTitle>
                    <CardDescription>Add context about this tag</CardDescription>
                </CardHeader>
                <CardContent>
                    {isEditingDescription ? (
                        <div className="space-y-2">
                            <Textarea
                                value={editedDescription}
                                onChange={(e) => setEditedDescription(e.target.value)}
                                placeholder="Describe what this tag is used for..."
                                rows={3}
                            />
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleDescriptionSave}>Save</Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setIsEditingDescription(false);
                                        setEditedDescription(tag.description || "");
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="text-sm cursor-pointer hover:bg-muted p-2 rounded min-h-[60px]"
                            onClick={() => {
                                setEditedDescription(tag.description || "");
                                setIsEditingDescription(true);
                            }}
                        >
                            {tag.description || (
                                <span className="text-muted-foreground italic">Click to add description...</span>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
                <CardHeader>
                    <CardTitle>Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <FileText size={16} className="text-muted-foreground" />
                        <span>{tag.usageCount} notes</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} className="text-muted-foreground" />
                        <span>
                            Last used {formatDistanceToNow(new Date(tag.lastUsed), { addSuffix: true })}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Calendar size={16} className="text-muted-foreground" />
                        <span>
                            Created {formatDistanceToNow(new Date(tag.createdAt), { addSuffix: true })}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Color Management */}
            <Card>
                <CardHeader>
                    <CardTitle>Color</CardTitle>
                    <CardDescription>Customize the tag color</CardDescription>
                </CardHeader>
                <CardContent>
                    <ColorPicker
                        value={tag.color}
                        onChange={onRecolor}
                    />
                </CardContent>
            </Card>

            {/* Related Tags */}
            {
                relatedTags.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TrendingUp size={18} />
                                Related Tags
                            </CardTitle>
                            <CardDescription>Tags frequently used together</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {relatedTags.map(({ tag: relatedTag, strength }) => (
                                    <Badge
                                        key={relatedTag.id}
                                        variant="outline"
                                        className="cursor-pointer hover:bg-accent"
                                        style={{
                                            borderColor: relatedTag.color || undefined,
                                            color: relatedTag.color || undefined,
                                        }}
                                    >
                                        {relatedTag.name}
                                        <span className="ml-1 text-xs text-muted-foreground">({strength})</span>
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )
            }

            {/* Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full" onClick={onMerge}>
                        <GitMerge size={16} className="mr-2" />
                        Merge with another tag
                    </Button>
                    <Button variant="destructive" className="w-full" onClick={onDelete}>
                        <Trash2 size={16} className="mr-2" />
                        Delete tag
                    </Button>
                </CardContent>
            </Card>

            {/* Top Notes */}
            <Card>
                <CardHeader>
                    <CardTitle>Top Notes ({topNotes.length})</CardTitle>
                    <CardDescription>Recent notes with this tag</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {topNotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No notes with this tag</p>
                    ) : (
                        topNotes.map((note) => (
                            <div
                                key={note.id}
                                className="flex items-start justify-between p-2 rounded hover:bg-muted"
                            >
                                <Link href={`/notes/${note.id}`} className="flex-1">
                                    <p className="font-medium text-sm">{note.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                        {note.contentText}
                                    </p>
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onRemoveNoteTag(note.id)}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div >
    );
}
