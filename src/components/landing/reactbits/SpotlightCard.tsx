"use client";

// Adapted from reactbits.dev "SpotlightCard". A radial cursor-following glow
// revealed on hover. The glow color is driven by --rb-spotlight-color.

import { cn } from "@/lib/utils";
import { useRef, useState } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
}

export default function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(79, 209, 224, 0.25)",
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(0);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = divRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--rb-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--rb-y", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        "rb-spotlight-card relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]",
        className
      )}
      style={{ "--rb-spotlight-color": spotlightColor } as React.CSSProperties}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          opacity,
          background:
            "radial-gradient(600px circle at var(--rb-x) var(--rb-y), var(--rb-spotlight-color), transparent 40%)",
        }}
      />
      {children}
    </div>
  );
}
