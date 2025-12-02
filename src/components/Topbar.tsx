import React from "react";
import { Separator } from "./ui/separator";

export const Topbar = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <section>
      <div className="h-12 w-full flex justify-between items-center p-2">
        {children}
      </div>
      <Separator />
    </section>
  );
};
