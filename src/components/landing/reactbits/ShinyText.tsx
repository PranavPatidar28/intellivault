"use client";

// Adapted from reactbits.dev "ShinyText". A subtle moving sheen across text.
// Pure CSS (keyframes in reactbits.css).

import { cn } from "@/lib/utils";

interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export default function ShinyText({
  text,
  disabled = false,
  speed = 5,
  className,
}: ShinyTextProps) {
  return (
    <span
      className={cn("rb-shiny-text", disabled && "rb-shiny-text--off", className)}
      style={{ animationDuration: `${speed}s` } as React.CSSProperties}
    >
      {text}
    </span>
  );
}
