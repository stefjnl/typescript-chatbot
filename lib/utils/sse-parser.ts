/**
 * SSE Parser abstraction for Open/Closed Principle compliance.
 * Allows extending SSE parsing logic without modifying existing code.
 */

import type { ChatCompletionChunk } from "@/types/api";

export interface SSEParseResult {
  content?: string;
  done: boolean;
}

export interface SSEParser {
  /**
   * Determines if this parser can handle the given payload
   */
  canParse(payload: string): boolean;
  
  /**
   * Parses the payload and extracts content and completion status
   */
  parse(payload: string): SSEParseResult;
}

/**
 * Default parser for NanoGPT API responses
 */
export class NanoGPTParser implements SSEParser {
  private accumulatedContent = "";

  canParse(payload: string): boolean {
    // NanoGPT sends JSON payloads starting with '{'
    return payload.trim().startsWith("{");
  }

  parse(payload: string): SSEParseResult {
    const chunk = JSON.parse(payload) as ChatCompletionChunk;
    
    const deltaReasoning = chunk.choices[0]?.delta?.reasoning ?? "";
    const delta =
      chunk.choices[0]?.delta?.content ??
      chunk.choices[0]?.delta?.text ??
      deltaReasoning ??
      "";
    const messageContent = chunk.choices[0]?.message?.content ?? "";
    const finishReason = chunk.choices[0]?.finish_reason;

    let contentPiece = "";
    if (delta) {
      contentPiece = delta;
    } else if (!this.accumulatedContent && messageContent) {
      contentPiece = messageContent;
    }

    if (contentPiece) {
      this.accumulatedContent += contentPiece;
    }

    // Handle case where finish_reason exists but no delta was sent
    if (finishReason && !contentPiece && messageContent && !this.accumulatedContent) {
      this.accumulatedContent = messageContent;
      contentPiece = messageContent;
    }

    return {
      content: contentPiece || undefined,
      done: Boolean(finishReason),
    };
  }

  /**
   * Reset accumulated content (useful for reusing the parser)
   */
  reset(): void {
    this.accumulatedContent = "";
  }
}
