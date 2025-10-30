import type { ChatMessage } from "@/types/chat";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callNanoGPT } from "./nanogpt";

const messages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Hello",
    timestamp: "2024-01-01T00:00:00.000Z",
  },
];

describe("callNanoGPT", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends request with system prompt and API key", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(new ReadableStream({ start: (controller) => controller.close() }), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const response = await callNanoGPT({
      apiKey: "secret",
      messages,
      stream: true,
      traceId: "trace",
    });

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://nano-gpt.com/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      })
    );

    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1]?.body as string) ?? "{}"
    );
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a helpful assistant." });
    expect(body.messages[1]).toEqual({ role: "user", content: "Hello" });
  });

  it("propagates API errors with metadata", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Service unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      callNanoGPT({ apiKey: "secret", messages, stream: true })
    ).rejects.toMatchObject({
      message: "Service unavailable",
      status: 503,
      retryable: true,
    });
  });

  // Note: This test triggers a "PromiseRejectionHandledWarning" due to a known limitation
  // when combining jsdom's AbortSignal implementation with Vitest's fake timers.
  // The rejection IS handled by the test (expect().rejects.toThrow) but jsdom's async
  // event dispatching causes the rejection to occur before the handler can attach.
  // This is cosmetic - all assertions pass correctly.
  it("aborts requests when timeout elapses", async () => {
    vi.useFakeTimers();
    
    const fetchSpy = vi.fn().mockImplementation(
      async (_url: string, init?: RequestInit) => {
        return new Promise<Response>(( _resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          }, { once: true });
          
          // Also check immediately in case already aborted
          if (init?.signal?.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
          }
        });
      }
    );
    vi.stubGlobal("fetch", fetchSpy);

    const promise = callNanoGPT({
      apiKey: "secret",
      messages,
      timeoutMs: 10,
    });

    // Advance timers to trigger the timeout
    await vi.advanceTimersByTimeAsync(11);

    // Ensure the promise is properly rejected and caught
    await expect(promise).rejects.toThrow("Aborted");
    
    const signal = fetchSpy.mock.calls[0][1]?.signal as AbortSignal | undefined;
    expect(signal?.aborted).toBe(true);

    vi.useRealTimers();
  });
});
