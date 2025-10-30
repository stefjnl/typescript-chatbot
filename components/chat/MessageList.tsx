"use client";

import { Message } from "@/components/chat/Message";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import type { ChatMessage } from "@/types/chat";
import type { VirtualItem } from "@tanstack/react-virtual";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  onRegenerate: (message: ChatMessage) => void;
}

export function MessageList({ messages, isStreaming, onRegenerate }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const totalCount = messages.length + (isStreaming ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 6,
    getItemKey: (index: number) => {
      if (isStreaming && index === totalCount - 1) {
        return "typing-indicator";
      }

      return messages[index]?.id ?? index;
    },
  });

  useEffect(() => {
    const lastIndex = totalCount - 1;
    if (lastIndex < 0) {
      return;
    }

    const id = requestAnimationFrame(() => {
      virtualizer.scrollToIndex(lastIndex, {
        align: "end",
        behavior: "auto",
      });
    });

    return () => cancelAnimationFrame(id);
  }, [totalCount, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 pb-24 pt-6"
      aria-live="polite"
      aria-label="Conversation messages"
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualRow: VirtualItem) => {
          const isTypingRow = isStreaming && virtualRow.index === totalCount - 1;

          if (isTypingRow) {
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <TypingIndicator />
              </div>
            );
          }
          const message = messages[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <Message
                message={message}
                isStreaming={isStreaming}
                onRegenerate={() => onRegenerate(message)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
