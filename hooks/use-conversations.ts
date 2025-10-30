"use client";

import {
  appendMessage,
  createConversation,
  exportConversations,
  findConversation,
  importConversations,
  loadConversations,
  persistConversations,
  replaceMessage,
  deleteConversation as storageDeleteConversation,
} from "@/lib/storage/conversations";
import type { ChatMessage, Conversation } from "@/types/chat";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseConversationsOptions {
  initialConversationId?: string;
}

interface UseConversationsValue {
  conversations: Conversation[];
  activeConversation?: Conversation;
  activeConversationId?: string;
  isReady: boolean;
  createConversation: (seedMessage?: ChatMessage) => Conversation;
  selectConversation: (conversationId: string) => void;
  deleteConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  addMessage: (
    conversationId: string,
    message: ChatMessage
  ) => Conversation | undefined;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string
  ) => Conversation | undefined;
  overwriteConversation: (conversation: Conversation) => Conversation;
  exportData: () => string;
  importData: (json: string) => void;
}

export function useConversations({
  initialConversationId,
}: UseConversationsOptions = {}): UseConversationsValue {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] =
    useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const existing = loadConversations();
    if (existing.length === 0) {
      const conversation = createConversation();
      persistConversations([conversation]);
      setConversations([conversation]);
      setActiveConversationId(conversation.id);
      setIsReady(true);
      return;
    }

    setConversations(existing);
    const activeId =
      existing.find(
        (conversation: Conversation) => conversation.id === initialConversationId
      )
        ?.id ?? existing[0]?.id;
    setActiveConversationId(activeId);
    setIsReady(true);
  }, [initialConversationId]);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation: Conversation) => conversation.id === activeConversationId
      ),
    [conversations, activeConversationId]
  );

  const selectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
  }, []);

  const moveConversationToFront = useCallback(
    (list: Conversation[], conversation: Conversation): Conversation[] => {
      const index = list.findIndex((item) => item.id === conversation.id);
      if (index === -1) {
        return [conversation, ...list];
      }

      const next = [...list];
      next.splice(index, 1);
      next.unshift(conversation);
      return next;
    },
    []
  );

  const sync = useCallback(
    (updater: (current: Conversation[]) => Conversation[]) => {
      setConversations((current) => {
        const next = updater(current);
        persistConversations(next);
        return next;
      });
    },
    []
  );

  const createNewConversation = useCallback(
    (seedMessage?: ChatMessage) => {
      const conversation = createConversation(seedMessage);
      sync((current) => [conversation, ...current]);
      setActiveConversationId(conversation.id);
      return conversation;
    },
    [sync]
  );

  const deleteConversation = useCallback(
    (conversationId: string) => {
      const next = storageDeleteConversation(conversationId);
      setConversations(next);
      if (activeConversationId === conversationId) {
        setActiveConversationId(next[0]?.id);
      }
    },
    [activeConversationId]
  );

  const renameConversation = useCallback(
    (conversationId: string, title: string) => {
      const conversation = findConversation(conversationId);
      if (!conversation) {
        return;
      }

      const updated: Conversation = {
        ...conversation,
        title,
        updatedAt: new Date().toISOString(),
      };
      sync((current) => moveConversationToFront(current, updated));
    },
    [moveConversationToFront, sync]
  );

  const addMessage = useCallback(
    (conversationId: string, message: ChatMessage) => {
      const updated = appendMessage(conversationId, message);
      if (!updated) {
        return undefined;
      }

      sync((current) => moveConversationToFront(current, updated));
      return updated;
    },
    [moveConversationToFront, sync]
  );

  const updateMessage = useCallback(
    (conversationId: string, messageId: string, content: string) => {
      const updated = replaceMessage(conversationId, messageId, content);
      if (!updated) {
        return undefined;
      }

      sync((current) => moveConversationToFront(current, updated));
      return updated;
    },
    [moveConversationToFront, sync]
  );

  const overwriteConversation = useCallback(
    (conversation: Conversation) => {
      sync((current) => moveConversationToFront(current, conversation));
      return conversation;
    },
    [moveConversationToFront, sync]
  );

  const exportData = useCallback(() => exportConversations(), []);

  const importData = useCallback(
    (json: string) => {
      const next = importConversations(json);
      setConversations(next);
      setActiveConversationId(next[0]?.id);
    },
    []
  );

  return {
    conversations,
    activeConversation,
    activeConversationId,
    isReady,
    createConversation: createNewConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    addMessage,
    updateMessage,
    overwriteConversation,
    exportData,
    importData,
  };
}
