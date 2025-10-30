"use client";

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { useChatInput } from "@/hooks/use-chat-input";
import { useChatMessages } from "@/hooks/use-chat-messages";
import { useChatNavigation } from "@/hooks/use-chat-navigation";
import { useConversations } from "@/hooks/use-conversations";
import { useStreaming } from "@/hooks/use-streaming";
import { type ChatClient } from "@/lib/api/chat-client";
import type { ChatMessage } from "@/types/chat";

interface UseChatControllerOptions {
  initialConversationId?: string;
  createNewConversation?: boolean;
  chatClient?: ChatClient;
}

type ConversationsState = ReturnType<typeof useConversations>;

export interface UseChatControllerResult {
  conversations: ConversationsState["conversations"];
  activeConversation: ConversationsState["activeConversation"];
  activeConversationId: ConversationsState["activeConversationId"];
  isReady: ConversationsState["isReady"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isStreaming: boolean;
  error: string | null;
  placeholderMessages: ChatMessage[];
  onSendMessage: () => Promise<void>;
  onRegenerateMessage: (message: ChatMessage) => Promise<void>;
  onStopStreaming: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onImportConversations: (json: string) => void;
  renameConversation: ConversationsState["renameConversation"];
  deleteConversation: ConversationsState["deleteConversation"];
  exportData: ConversationsState["exportData"];
}

export function useChatController(
  options: UseChatControllerOptions
): UseChatControllerResult {
  const { initialConversationId, createNewConversation = false, chatClient } = options;
  
  // Error state management
  const [error, setError] = useState<string | null>(null);

  // Conversation state management
  const {
    conversations,
    activeConversation,
    activeConversationId,
    isReady,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    addMessage,
    updateMessage,
    exportData,
    importData,
  } = useConversations({ initialConversationId });

  // Input state management
  const { input, setInput, clearInput } = useChatInput();

  // Streaming management (with optional chatClient injection for DIP)
  const { isStreaming, startStream, stopStream } = useStreaming({
    onError: setError,
    chatClient,
  });

  // Message sending logic
  const { sendMessage, regenerateMessage } = useChatMessages({
    conversationId: activeConversationId ?? "",
    messages: activeConversation?.messages ?? [],
    addMessage,
    updateMessage,
    startStream,
  });

  // Navigation management
  const { handleNewChat, handleSelectConversation } = useChatNavigation({
    createNewConversation,
    activeConversationId,
    isReady,
    onCreateConversation: createConversation,
    onSelectConversation: selectConversation,
  });

  // Message sending handler
  const handleSendMessage = useCallback(async () => {
    if (!activeConversation || !input.trim()) {
      return;
    }

    setError(null);

    try {
      await sendMessage(input);
      clearInput();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
    }
  }, [activeConversation, input, sendMessage, clearInput]);

  // Message regeneration handler
  const handleRegenerate = useCallback(
    async (message: ChatMessage) => {
      if (!activeConversation) {
        return;
      }

      setError(null);

      try {
        await regenerateMessage(message);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to regenerate message";
        setError(errorMessage);
      }
    },
    [activeConversation, regenerateMessage]
  );

  // Import handler
  const handleImport = useCallback(
    (json: string) => {
      try {
        importData(json);
      } catch (importError) {
        console.error(importError);
        setError("Failed to import conversations. Invalid file format.");
      }
    },
    [importData]
  );

  // Placeholder messages for empty conversations
  const placeholderMessages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "placeholder-1",
        role: "assistant",
        content:
          "Ask me anything to get started. Try \"Explain TypeScript generics\".",
        timestamp: new Date().toISOString(),
      },
    ],
    []
  );

  return {
    conversations,
    activeConversation,
    activeConversationId,
    isReady,
    input,
    setInput,
    isStreaming,
    error,
    placeholderMessages,
    onSendMessage: handleSendMessage,
    onRegenerateMessage: handleRegenerate,
    onStopStreaming: stopStream,
    onCreateConversation: handleNewChat,
    onSelectConversation: handleSelectConversation,
    onImportConversations: handleImport,
    renameConversation,
    deleteConversation,
    exportData,
  };
}
