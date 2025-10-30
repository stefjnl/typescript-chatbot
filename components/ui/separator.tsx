"use client";

import { cn } from "@/lib/utils/cn";
import * as React from "react";

const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "vertical" | "horizontal";
  }
>(({ className, orientation = "horizontal", role = "separator", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className
    )}
    role={role}
    aria-orientation={orientation}
    {...props}
  />
));
Separator.displayName = "Separator";

export { Separator };
