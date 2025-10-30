/**
 * Chat-specific domain types used across the application.
 */
export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: Exclude<ChatRole, "system">;
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

export interface TypingIndicator {
  isTyping: boolean;
  messageId?: string;
}

export interface StreamingChunk {
  conversationId: string;
  messageId: string;
  content: string;
  done: boolean;
}
