import React from "react";
import { cn } from "@/lib/utils";

export const Topbar = ({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) => {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex-shrink-0 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65",
        className
      )}
    >
      <div className="flex h-14 w-full items-center justify-between gap-4 px-4 md:px-6">
        {children}
      </div>
    </header>
  );
};
