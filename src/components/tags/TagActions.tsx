"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Tag {
    id: string;
    name: string;
}

interface MergeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    sourceTags: Tag[];
    allTags: Tag[];
    onConfirm: (targetTagId: string) => void;
}

export function MergeDialog({
    isOpen,
    onClose,
    sourceTags,
    allTags,
    onConfirm,
}: MergeDialogProps) {
    const [targetTagId, setTargetTagId] = useState("");

    const availableTags = allTags.filter(
        (tag) => !sourceTags.some((st) => st.id === tag.id)
    );

    const handleConfirm = () => {
        if (targetTagId) {
            onConfirm(targetTagId);
            setTargetTagId("");
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Merge Tags</DialogTitle>
                    <DialogDescription>
                        Merge {sourceTags.length} tag{sourceTags.length !== 1 ? "s" : ""} into a single tag.
                        All notes will be updated.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Source Tags</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {sourceTags.map((tag) => (
                                <span
                                    key={tag.id}
                                    className="text-sm bg-muted px-2 py-1 rounded"
                                >
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label>Target Tag</Label>
                        <Select value={targetTagId} onValueChange={setTargetTagId}>
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Select target tag..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableTags.map((tag) => (
                                    <SelectItem key={tag.id} value={tag.id}>
                                        {tag.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={!targetTagId}>
                        Merge Tags
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface DeleteDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tags: Tag[];
    onConfirm: () => void;
}

export function DeleteDialog({
    isOpen,
    onClose,
    tags,
    onConfirm,
}: DeleteDialogProps) {
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Tags</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete {tags.length} tag{tags.length !== 1 ? "s" : ""}?
                        This action will soft-delete the tags. Notes will retain their connections.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <span
                            key={tag.id}
                            className="text-sm bg-destructive/10 text-destructive px-2 py-1 rounded"
                        >
                            {tag.name}
                        </span>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleConfirm}>
                        Delete Tag{tags.length !== 1 ? "s" : ""}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface RenameDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentName: string;
    onConfirm: (newName: string) => void;
}

export function RenameDialog({
    isOpen,
    onClose,
    currentName,
    onConfirm,
}: RenameDialogProps) {
    const [newName, setNewName] = useState(currentName);

    const handleConfirm = () => {
        if (newName.trim() && newName !== currentName) {
            onConfirm(newName.trim());
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rename Tag</DialogTitle>
                    <DialogDescription>
                        Enter a new name for this tag.
                    </DialogDescription>
                </DialogHeader>

                <div>
                    <Label>Tag Name</Label>
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handleConfirm();
                        }}
                        className="mt-2"
                        autoFocus
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={!newName.trim() || newName === currentName}>
                        Rename
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
