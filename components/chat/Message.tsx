"use client";

import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Clipboard, RefreshCw } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onCopy?: (content: string) => void;
  onRegenerate?: () => void;
}

const USER_AVATAR_FALLBACK = "You";
const ASSISTANT_AVATAR_FALLBACK = "AI";

export function Message({ message, isStreaming, onCopy, onRegenerate }: MessageProps) {
  const isUser = message.role === "user";

  const relativeTimestamp = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(message.timestamp), { addSuffix: true });
    } catch {
      return "Just now";
    }
  }, [message.timestamp]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(message.content);
    onCopy?.(message.content);
  };

  return (
    <div className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
      title={relativeTimestamp}
    >
      {!isUser && (
        <Avatar fallback={ASSISTANT_AVATAR_FALLBACK} className="mt-1 hidden sm:flex" />
      )}
      <div
        className={cn(
          "max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-colors sm:max-w-2xl",
          isUser
            ? "bg-primary text-primary-foreground ml-auto"
            : "bg-card text-card-foreground border"
        )}
      >
        <MarkdownRenderer content={message.content} />
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{relativeTimestamp}</span>
            </TooltipTrigger>
            <TooltipContent>{new Date(message.timestamp).toLocaleString()}</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleCopy}
                  aria-label="Copy message"
                >
                  <Clipboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy message</TooltipContent>
            </Tooltip>
            {!isUser && onRegenerate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={onRegenerate}
                    aria-label="Regenerate response"
                    disabled={isStreaming}
                  >
                    <RefreshCw className={cn("h-4 w-4", isStreaming && "animate-spin")}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      {isUser && (
        <Avatar fallback={USER_AVATAR_FALLBACK} className="mt-1 hidden sm:flex" />
      )}
    </div>
  );
}
