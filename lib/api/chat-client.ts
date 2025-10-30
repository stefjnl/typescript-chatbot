/**
 * Chat client abstraction for dependency inversion.
 * Allows for easy testing and potential future backend changes.
 */

export interface ChatRequest {
  conversationId: string;
  messages: unknown[];
  responseMessageId?: string;
  signals?: {
    regenerate?: boolean;
  };
  traceId: string;
  signal?: AbortSignal;
}

export interface ChatClient {
  sendMessage(request: ChatRequest): Promise<Response>;
}

/**
 * Default implementation using the fetch API to call /api/chat
 */
export class FetchChatClient implements ChatClient {
  constructor(private readonly endpoint: string = "/api/chat") {}

  async sendMessage(request: ChatRequest): Promise<Response> {
    const { traceId, signal, ...body } = request;
    
    return fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Trace-Id": traceId,
      },
      body: JSON.stringify(body),
      signal,
    });
  }
}

/**
 * Mock implementation for testing purposes
 */
export class MockChatClient implements ChatClient {
  constructor(
    private readonly mockResponse: Response = new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode('data: {"conversationId":"test","messageId":"test","content":"Mock response","done":false}\n\n')
          );
          controller.enqueue(
            encoder.encode('data: {"conversationId":"test","messageId":"test","done":true}\n\n')
          );
          controller.close();
        },
      }),
      {
        headers: {
          "Content-Type": "text/event-stream",
        },
      }
    )
  ) {}

  async sendMessage(request: ChatRequest): Promise<Response> {
    void request;
    return this.mockResponse;
  }
}
