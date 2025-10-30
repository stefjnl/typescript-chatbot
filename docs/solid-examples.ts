/**
 * Example usage of the refactored SOLID-compliant code
 * This file demonstrates how to use the new abstractions
 */

import { useChatController } from "@/hooks/use-chat-controller";
import { FetchChatClient, MockChatClient, type ChatClient } from "@/lib/api/chat-client";
import { NanoGPTParser, type SSEParser } from "@/lib/utils/sse-parser";
import { createSSEStream } from "@/lib/utils/streaming";

// ============================================
// Example 1: Default Usage (Production)
// ============================================
// No changes needed - everything works as before
function ProductionExample() {
  const controller = useChatController({
    initialConversationId: "conv-123",
    createNewConversation: false,
  });
  
  return controller;
}

// ============================================
// Example 2: Custom Chat Client
// ============================================
// Inject a custom chat client for testing or different behavior
class LoggingChatClient implements ChatClient {
  constructor(private readonly baseClient: ChatClient) {}

  async sendMessage(request: Parameters<ChatClient['sendMessage']>[0]): Promise<Response> {
    console.log("Sending message:", request);
    const response = await this.baseClient.sendMessage(request);
    console.log("Received response:", response.status);
    return response;
  }
}

function TestingExample() {
  const loggingClient = new LoggingChatClient(new FetchChatClient());
  
  const controller = useChatController({
    initialConversationId: "test-conv",
    chatClient: loggingClient,
  });
  
  return controller;
}

// ============================================
// Example 3: Mock Client for Unit Tests
// ============================================
function UnitTestExample() {
  const mockClient = new MockChatClient();
  
  const controller = useChatController({
    initialConversationId: "mock-conv",
    chatClient: mockClient,
  });
  
  // Now you can test without making real API calls
  return controller;
}

// ============================================
// Example 4: Custom SSE Parser
// ============================================
// Create a parser for a different AI provider
class OpenAIParser implements SSEParser {
  canParse(payload: string): boolean {
    try {
      const parsed = JSON.parse(payload);
      return parsed.object === "chat.completion.chunk";
    } catch {
      return false;
    }
  }

  parse(payload: string): { content?: string; done: boolean } {
    const chunk = JSON.parse(payload);
    return {
      content: chunk.choices[0]?.delta?.content,
      done: chunk.choices[0]?.finish_reason !== null,
    };
  }
}

// Use it on the server side
function CustomParserExample(response: Response) {
  const openAIParser = new OpenAIParser();
  
  const stream = createSSEStream(
    response,
    "conv-id",
    "msg-id",
    "trace-id",
    openAIParser
  );
  
  return stream;
}

// ============================================
// Example 5: Retry Logic with Custom Client
// ============================================
class RetryingChatClient implements ChatClient {
  constructor(
    private readonly maxRetries: number = 3,
    private readonly baseClient: ChatClient = new FetchChatClient()
  ) {}

  async sendMessage(request: Parameters<ChatClient['sendMessage']>[0]): Promise<Response> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.baseClient.sendMessage(request);
        
        // Only retry on server errors (5xx)
        if (response.ok || response.status < 500) {
          return response;
        }
        
        console.log(`Attempt ${attempt + 1} failed with status ${response.status}`);
      } catch (error) {
        lastError = error as Error;
        console.log(`Attempt ${attempt + 1} failed:`, error);
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < this.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    throw lastError || new Error("All retry attempts failed");
  }
}

function RetryExample() {
  const retryClient = new RetryingChatClient(3);
  
  const controller = useChatController({
    initialConversationId: "retry-conv",
    chatClient: retryClient,
  });
  
  return controller;
}

// ============================================
// Example 6: Parser with Logging
// ============================================
class LoggingParser implements SSEParser {
  constructor(private readonly baseParser: SSEParser = new NanoGPTParser()) {}

  canParse(payload: string): boolean {
    const result = this.baseParser.canParse(payload);
    console.log(`Parser can parse: ${result}`, payload.substring(0, 100));
    return result;
  }

  parse(payload: string): { content?: string; done: boolean } {
    const result = this.baseParser.parse(payload);
    console.log("Parsed result:", result);
    return result;
  }
}

// Use it for debugging
function DebugParserExample(response: Response) {
  const loggingParser = new LoggingParser();
  
  return createSSEStream(
    response,
    "conv-id",
    "msg-id",
    "trace-id",
    loggingParser
  );
}

export {
    CustomParserExample, DebugParserExample, ProductionExample, RetryExample, TestingExample,
    UnitTestExample
};

