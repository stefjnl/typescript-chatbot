import { format } from "date-fns";
import { v4 as uuid } from "uuid";
import type { ChatMessage, Conversation } from "@/types/chat";

const CONVERSATIONS_KEY = "conversations";
const TITLE_FALLBACK = "New Conversation";

const isBrowser = () => typeof window !== "undefined";

function safeLocalStorage(): Storage | undefined {
  if (!isBrowser()) {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch (error) {
    console.error("localStorage unavailable", error);
    return undefined;
  }
}

/**
 * Loads the conversation list from localStorage.
 */
export function loadConversations(): Conversation[] {
  const storage = safeLocalStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(CONVERSATIONS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as { conversations?: Conversation[] };
    return parsed.conversations ?? [];
  } catch (error) {
    console.warn("Failed to parse conversations", error);
    return [];
  }
}

/**
 * Persists the provided conversations collection to localStorage.
 */
export function persistConversations(conversations: Conversation[]): void {
  const storage = safeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      CONVERSATIONS_KEY,
      JSON.stringify({ conversations })
    );
  } catch (error) {
    console.error("Failed to persist conversations", error);
  }
}

/**
 * Generates a user-friendly title using the first user message.
 */
export function generateTitle(firstMessage?: string): string {
  if (!firstMessage) {
    return TITLE_FALLBACK;
  }

  const trimmed = firstMessage.trim();
  if (!trimmed) {
    return TITLE_FALLBACK;
  }

  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

/**
 * Creates a fresh conversation with optional seed message.
 */
export function createConversation(seedMessage?: ChatMessage): Conversation {
  const timestamp = new Date().toISOString();
  const messages = seedMessage ? [seedMessage] : [];
  return {
    id: uuid(),
    title: generateTitle(seedMessage?.content),
    createdAt: timestamp,
    updatedAt: timestamp,
    messages,
  };
}

/**
 * Updates or inserts the provided conversation and returns the new array.
 */
export function upsertConversation(conversation: Conversation): Conversation[] {
  const conversations = loadConversations();
  const index = conversations.findIndex((item) => item.id === conversation.id);

  if (index >= 0) {
    conversations[index] = conversation;
  } else {
    conversations.unshift(conversation);
  }

  persistConversations(conversations);
  return conversations;
}

/**
 * Retrieves a conversation by id.
 */
export function findConversation(id: string): Conversation | undefined {
  return loadConversations().find((conversation) => conversation.id === id);
}

/**
 * Deletes a conversation by id and returns the updated array.
 */
export function deleteConversation(id: string): Conversation[] {
  const conversations = loadConversations().filter(
    (conversation) => conversation.id !== id
  );
  persistConversations(conversations);
  return conversations;
}

/**
 * Adds a message to a conversation and persists changes.
 */
export function appendMessage(
  conversationId: string,
  message: ChatMessage
): Conversation | undefined {
  const conversation = findConversation(conversationId);
  if (!conversation) {
    return undefined;
  }

  const updated: Conversation = {
    ...conversation,
    messages: [...conversation.messages, message],
    updatedAt: new Date().toISOString(),
  };

  upsertConversation(updated);
  return updated;
}

/**
 * Replaces a message content for the provided message id.
 */
export function replaceMessage(
  conversationId: string,
  messageId: string,
  content: string
): Conversation | undefined {
  const conversation = findConversation(conversationId);
  if (!conversation) {
    return undefined;
  }

  const messages = conversation.messages.map((message: ChatMessage) =>
    message.id === messageId ? { ...message, content } : message
  );

  const updated: Conversation = {
    ...conversation,
    messages,
    updatedAt: new Date().toISOString(),
  };

  upsertConversation(updated);
  return updated;
}

/**
 * Removes a specific message from a conversation.
 */
export function deleteMessage(
  conversationId: string,
  messageId: string
): Conversation | undefined {
  const conversation = findConversation(conversationId);
  if (!conversation) {
    return undefined;
  }

  const messages = conversation.messages.filter(
    (message: ChatMessage) => message.id !== messageId
  );

  const updated: Conversation = {
    ...conversation,
    messages,
    updatedAt: new Date().toISOString(),
  };

  upsertConversation(updated);
  return updated;
}

/**
 * Formats a timestamp into a human readable label.
 */
export function formatTimestamp(isoDate: string): string {
  try {
    return format(new Date(isoDate), "MMM d, yyyy p");
  } catch {
    return isoDate;
  }
}

/**
 * Exports conversations to a downloadable JSON string.
 */
export function exportConversations(): string {
  const conversations = loadConversations();
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      conversations,
    },
    null,
    2
  );
}

/**
 * Imports conversations merging them with the existing ones.
 */
export function importConversations(json: string): Conversation[] {
  try {
    const parsed = JSON.parse(json) as {
      conversations?: Conversation[];
    };

    if (!parsed.conversations) {
      throw new Error("Invalid file: conversations missing");
    }

    const existing = loadConversations();
    const mergedMap = new Map<string, Conversation>();

    [...existing, ...parsed.conversations].forEach((conversation) => {
      mergedMap.set(conversation.id, conversation);
    });

    const merged = Array.from(mergedMap.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );

    persistConversations(merged);
    return merged;
  } catch (error) {
    console.error("Failed to import conversations", error);
    throw error;
  }
}
