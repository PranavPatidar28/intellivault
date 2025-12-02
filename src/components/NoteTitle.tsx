"use client";

import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface NoteTitleProps {
  initialTitle: string;
  onTitleChange?: (title: string) => void;
}

export default function NoteTitle({ initialTitle, onTitleChange }: NoteTitleProps) {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  return (
    <Input
      value={title}
      onChange={(e) => handleTitleChange(e.target.value)}
      placeholder="Untitled Note"
      className="text-xl font-semibold border-none shadow-none h-auto focus-visible:ring-0 p-2 bg-transparent min-w-100"
    />
  );
}
