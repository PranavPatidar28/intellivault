"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface NoteTitleProps {
  initialTitle: string;
  onTitleChange?: (title: string) => void;
}

export default function NoteTitle({ initialTitle, onTitleChange }: NoteTitleProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    onTitleChange?.(newTitle);
  };

  return (
    <div className="relative group flex-1 min-w-0">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder="Untitled Note"
        className={cn(
          "w-full px-1 py-1",
          "text-xl font-bold tracking-tight",
          "bg-transparent border-none outline-none",
          "placeholder:text-muted-foreground/50 placeholder:font-normal",
          "transition-all duration-200",
          "focus:outline-none"
        )}
      />
      {/* Animated underline */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
        <div
          className={cn(
            "h-full bg-gradient-to-r from-primary via-primary/80 to-primary/60",
            "transition-transform duration-300 ease-out",
            isFocused ? "translate-x-0" : "-translate-x-full"
          )}
        />
      </div>
      {/* Subtle background on hover */}
      <div
        className={cn(
          "absolute inset-0 -z-10 rounded-md",
          "transition-colors duration-200",
          isFocused ? "bg-muted/30" : "group-hover:bg-muted/20"
        )}
      />
    </div>
  );
}
