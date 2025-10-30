"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

interface UseChatNavigationOptions {
  createNewConversation?: boolean;
  activeConversationId?: string;
  isReady: boolean;
  onCreateConversation: () => { id: string };
  onSelectConversation: (id: string) => void;
}

interface UseChatNavigationResult {
  handleNewChat: () => void;
  handleSelectConversation: (id: string) => void;
}

/**
 * Hook for managing chat navigation and routing.
 * Handles conversation selection, creation, and URL synchronization.
 */
export function useChatNavigation(options: UseChatNavigationOptions): UseChatNavigationResult {
  const {
    createNewConversation,
    activeConversationId,
    isReady,
    onCreateConversation,
    onSelectConversation,
  } = options;
  
  const router = useRouter();
  const autoCreatedConversationRef = useRef(false);

  // Reset auto-created flag when createNewConversation changes
  useEffect(() => {
    if (!createNewConversation) {
      autoCreatedConversationRef.current = false;
    }
  }, [createNewConversation]);

  // Auto-create conversation if needed
  useEffect(() => {
    if (
      !createNewConversation ||
      !isReady ||
      autoCreatedConversationRef.current
    ) {
      return;
    }
    
    const conversation = onCreateConversation();
    router.push(`/chat/${conversation.id}`);
    autoCreatedConversationRef.current = true;
  }, [createNewConversation, isReady, onCreateConversation, router]);

  // Sync URL with active conversation
  useEffect(() => {
    if (!isReady || !activeConversationId || createNewConversation) {
      return;
    }

    const targetPath = `/chat/${activeConversationId}`;
    if (window.location.pathname !== targetPath) {
      router.replace(targetPath);
    }
  }, [activeConversationId, createNewConversation, isReady, router]);

  const handleNewChat = useCallback(() => {
    const conversation = onCreateConversation();
    router.push(`/chat/${conversation.id}`);
  }, [onCreateConversation, router]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      onSelectConversation(id);
      router.push(`/chat/${id}`);
    },
    [onSelectConversation, router]
  );

  return {
    handleNewChat,
    handleSelectConversation,
  };
}
