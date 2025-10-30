"use client";

import type { SSEHandler } from "@/lib/utils/client-streaming";
import type { SSEPayload } from "@/lib/utils/streaming";
import type { ChatMessage } from "@/types/chat";
import { useCallback } from "react";
import { v4 as uuid } from "uuid";
import type { UseStreamingResult } from "./use-streaming";

interface UseChatMessagesOptions {
  conversationId: string;
  messages: ChatMessage[];
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  startStream: UseStreamingResult["startStream"];
}

interface UseChatMessagesResult {
  sendMessage: (content: string) => Promise<{ userMessageId: string; assistantMessageId: string }>;
  regenerateMessage: (message: ChatMessage) => Promise<void>;
}

const TRACE_SOURCE = "ChatMessages";

/**
 * Hook for handling chat message sending and regeneration logic.
 * Manages message creation, validation, and streaming coordination.
 */
export function useChatMessages(options: UseChatMessagesOptions): UseChatMessagesResult {
  const { conversationId, messages, addMessage, updateMessage, startStream } = options;

  const sendMessage = useCallback(
    async (content: string): Promise<{ userMessageId: string; assistantMessageId: string }> => {
      const trimmed = content.trim();
      if (!trimmed) {
        throw new Error("Message content cannot be empty");
      }

      const userMessage: ChatMessage = {
        id: uuid(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      const assistantMessage: ChatMessage = {
        id: uuid(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      // Filter out empty messages and add user message
      const validMessages = messages.filter((msg) => msg.content.trim() !== "");
      const messagesToSend = [...validMessages, userMessage];

      // Add both messages to the conversation
      addMessage(conversationId, userMessage);
      addMessage(conversationId, assistantMessage);

      const traceId = uuid();
      let partialContent = "";

      const handlePayload: SSEHandler = (payload: SSEPayload): boolean => {
        if (payload.messageId !== assistantMessage.id) {
          return false;
        }

        if (payload.content) {
          partialContent += payload.content;
          updateMessage(conversationId, assistantMessage.id, partialContent);
        }

        if (payload.done) {
          return true;
        }

        return false;
      };

      await startStream(
        "/api/chat",
        {
          conversationId,
          messages: messagesToSend,
          responseMessageId: assistantMessage.id,
        },
        handlePayload,
        traceId,
        TRACE_SOURCE
      );

      // Ensure message is cleared if no content was received
      if (partialContent === "") {
        updateMessage(conversationId, assistantMessage.id, "");
        throw new Error("No response received from the assistant");
      }

      return {
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      };
    },
    [conversationId, messages, addMessage, updateMessage, startStream]
  );

  const regenerateMessage = useCallback(
    async (message: ChatMessage): Promise<void> => {
      // Filter out the message being regenerated and empty messages
      const messagesToSend = messages.filter(
        (m) => m.id !== message.id && m.content.trim() !== ""
      );

      // Clear the existing message content
      updateMessage(conversationId, message.id, "");

      const traceId = uuid();
      let partialContent = "";

      const handlePayload: SSEHandler = (payload: SSEPayload): boolean => {
        if (payload.messageId !== message.id) {
          return false;
        }

        if (payload.content) {
          partialContent += payload.content;
          updateMessage(conversationId, message.id, partialContent);
        }

        if (payload.done) {
          return true;
        }

        return false;
      };

      await startStream(
        "/api/chat",
        {
          conversationId,
          messages: messagesToSend,
          responseMessageId: message.id,
          signals: { regenerate: true },
        },
        handlePayload,
        traceId,
        TRACE_SOURCE
      );
    },
    [conversationId, messages, updateMessage, startStream]
  );

  return {
    sendMessage,
    regenerateMessage,
  };
}
