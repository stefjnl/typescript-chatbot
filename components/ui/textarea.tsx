"use client";

import { cn } from "@/lib/utils/cn";
import * as React from "react";
import TextareaAutosize from "react-textarea-autosize";

export type TextareaProps = React.ComponentPropsWithoutRef<typeof TextareaAutosize>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, maxRows = 8, minRows = 2, ...props }, ref) => {
    return (
      <TextareaAutosize
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        minRows={minRows}
        maxRows={maxRows}
        ref={ref}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

export { Textarea };
