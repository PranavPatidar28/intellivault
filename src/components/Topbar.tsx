import React from "react";
import { Separator } from "./ui/separator";

export const Topbar = ({
  children,
  className,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) => {
  return (
    <section className={className}>
      <div className="h-12 w-full flex justify-between items-center p-2">
        {children}
      </div>
      <Separator />
    </section>
  );
};
