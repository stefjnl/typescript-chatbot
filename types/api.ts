/**
 * API-level types for the NanoGPT integration and internal chat endpoint.
 */
import type { ChatMessage } from "./chat";

type CompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface ChatCompletionRequest {
  model: string;
  messages: CompletionMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  cache_control?: {
    enabled: boolean;
    ttl?: string;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      role?: "assistant";
      text?: string;
    };
    message?: {
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

export interface ChatApiRequestBody {
  conversationId: string;
  messages: ChatMessage[];
  responseMessageId?: string;
  signals?: {
    regenerate?: boolean;
  };
}

export interface ChatApiError {
  status: number;
  message: string;
  retryable: boolean;
}
