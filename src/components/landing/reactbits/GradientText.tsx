"use client";

// Adapted from reactbits.dev "GradientText". Animated gradient fill on text.
// Pure CSS animation (keyframes in reactbits.css).

import { cn } from "@/lib/utils";

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
}

export default function GradientText({
  children,
  className,
  colors = ["#8AE5EF", "#4FD1E0", "#8AE5EF", "#4FD1E0", "#8AE5EF"],
  animationSpeed = 8,
}: GradientTextProps) {
  return (
    <span
      className={cn("rb-gradient-text", className)}
      style={
        {
          backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
          animationDuration: `${animationSpeed}s`,
        } as React.CSSProperties
      }
    >
      {children}
    </span>
  );
}
