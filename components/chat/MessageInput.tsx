"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { Send, Square } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { useCallback } from "react";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 4000;

export function MessageInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming = false,
  maxLength = DEFAULT_MAX_LENGTH,
}: MessageInputProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!isStreaming && value.trim().length > 0) {
          onSubmit();
        }
      }
    },
    [isStreaming, onSubmit, value]
  );

  const remaining = maxLength - value.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-3xl border border-border bg-card/80 p-4 shadow-lg backdrop-blur">
      <Textarea
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        placeholder="Send a message..."
        className="min-h-[120px] resize-none bg-transparent text-base"
      />
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>
          Press <kbd className="rounded border bg-muted px-1">Enter</kbd> to send •
          <span className={cn("ml-1", remaining < 0 && "text-destructive")}>{remaining} characters left</span>
        </span>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <Button
              type="button"
              variant="outline"
              onClick={onStop}
              className="gap-2"
            >
              <Square className="h-4 w-4" /> Stop
            </Button>
          )}
          <Button
            type="button"
            onClick={onSubmit}
            disabled={value.trim().length === 0 || isStreaming}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
