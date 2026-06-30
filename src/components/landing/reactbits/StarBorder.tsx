"use client";

// Adapted from reactbits.dev "StarBorder". A rotating gradient light travels
// around the border of the element. Keyframes live in reactbits.css.

import { cn } from "@/lib/utils";

interface StarBorderProps<T extends React.ElementType> {
  as?: T;
  className?: string;
  color?: string;
  speed?: string;
  thickness?: number;
  children: React.ReactNode;
}

export default function StarBorder<T extends React.ElementType = "button">({
  as,
  className,
  color = "#8AE5EF",
  speed = "6s",
  thickness = 1,
  children,
  ...rest
}: StarBorderProps<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof StarBorderProps<T>>) {
  const Component = (as || "button") as React.ElementType;

  return (
    <Component
      className={cn("rb-star-border", className)}
      style={
        {
          padding: `${thickness}px`,
          ...(rest as { style?: React.CSSProperties }).style,
        } as React.CSSProperties
      }
      {...rest}
    >
      <div
        className="rb-star-border__trail rb-star-border__trail--bottom"
        style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, animationDuration: speed }}
      />
      <div
        className="rb-star-border__trail rb-star-border__trail--top"
        style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, animationDuration: speed }}
      />
      <div className="rb-star-border__inner">{children}</div>
    </Component>
  );
}
