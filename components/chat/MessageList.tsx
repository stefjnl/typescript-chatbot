"use client";

import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { ChatMessage } from "@/types/chat";
import { Message } from "@/components/chat/Message";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  onRegenerate: (message: ChatMessage) => void;
}

export function MessageList({ messages, isStreaming, onRegenerate }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    return isStreaming ? [...messages, createTypingMessage()] : messages;
  }, [messages, isStreaming]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 6,
    getItemKey: (index: number) => items[index]?.id ?? index,
  });

  useEffect(() => {
    const lastIndex = items.length - 1;
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
  }, [items, virtualizer]);

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
          const message = items[virtualRow.index];
          if (message.id === "typing-indicator") {
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

function createTypingMessage(): ChatMessage {
  return {
    id: "typing-indicator",
    role: "assistant",
    content: "",
    timestamp: new Date().toISOString(),
  };
}
