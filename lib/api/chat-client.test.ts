import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchChatClient, MockChatClient, type ChatRequest } from "./chat-client";

describe("FetchChatClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends POST requests with JSON payload and trace headers", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const client = new FetchChatClient("/api/chat");
    const controller = new AbortController();
    const request: ChatRequest = {
      conversationId: "conversation",
      messages: [],
      traceId: "trace",
      signal: controller.signal,
    };

    await client.sendMessage(request);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Trace-Id": "trace",
        }),
        body: JSON.stringify({ conversationId: "conversation", messages: [] }),
        signal: controller.signal,
      })
    );
  });
});

describe("MockChatClient", () => {
  it("returns a canned SSE response", async () => {
    const client = new MockChatClient();
    const response = await client.sendMessage({
      conversationId: "conversation",
      messages: [],
      traceId: "trace",
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const first = await reader!.read();
    const decoded = new TextDecoder().decode(first.value);
    expect(decoded).toContain("Mock response");
  });
});
