import type { ChatClient } from "@/lib/api/chat-client";
import { readSseStream } from "@/lib/utils/client-streaming";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStreaming } from "./use-streaming";

vi.mock("@/lib/utils/client-streaming", () => ({
  readSseStream: vi.fn(),
}));

describe("useStreaming", () => {
  const handler = vi.fn();
  const readSseStreamMock = vi.mocked(readSseStream);

  beforeEach(() => {
    vi.clearAllMocks();
    handler.mockReset();
    readSseStreamMock.mockReset();
  });

  it("starts and completes streaming lifecycle", async () => {
    const sendMessage = vi
      .fn<Parameters<ChatClient["sendMessage"]>, ReturnType<ChatClient["sendMessage"]>>()
      .mockResolvedValue(
      new Response(new ReadableStream({ start: (controller) => controller.close() }), {
        headers: { "Content-Type": "text/event-stream" },
      })
    );
    let resolveStream: () => void = () => {};
    readSseStreamMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStream = resolve;
        })
    );

    const { result } = renderHook(() =>
      useStreaming({
        onError: vi.fn(),
  chatClient: { sendMessage },
      })
    );

    let startPromise: Promise<void>;
    await act(async () => {
      startPromise = result.current.startStream(
        "/api/chat",
        { conversationId: "c" },
        handler,
        "trace",
        "source"
      );
    });

    expect(result.current.isStreaming).toBe(true);

    resolveStream();
    await act(async () => {
      await startPromise!;
    });

    expect(readSseStream).toHaveBeenCalledWith(expect.any(Response), handler, {
      traceId: "trace",
      source: "source",
    });
    expect(result.current.isStreaming).toBe(false);
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: "trace", conversationId: "c" })
    );
  });

  it("aborts the active stream when stopStream is called", { timeout: 10000 }, async () => {
    let capturedSignal: AbortSignal | undefined;
    const sendMessage = vi
      .fn<Parameters<ChatClient["sendMessage"]>, ReturnType<ChatClient["sendMessage"]>>()
      .mockImplementation(async (request: Parameters<ChatClient["sendMessage"]>[0]) => {
        capturedSignal = request.signal;
        return new Response(new ReadableStream({ start: () => {} }), {
          headers: { "Content-Type": "text/event-stream" },
        });
      });
    
    // Mock readSseStream to wait until aborted
    readSseStreamMock.mockImplementation(
      () => new Promise((_resolve, reject) => {
        if (capturedSignal) {
          capturedSignal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      })
    );

    const { result } = renderHook(() =>
      useStreaming({
        onError: vi.fn(),
  chatClient: { sendMessage },
      })
    );

    let streamPromise: Promise<void>;
    act(() => {
      streamPromise = result.current.startStream(
        "/api/chat",
        { conversationId: "c" },
        handler,
        "trace",
        "source"
      );
    });

    // Wait a tick for the stream to start
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Stop the stream
    await act(async () => {
      result.current.stopStream();
    });

    // Wait for the promise to complete (it should reject with AbortError)
    await act(async () => {
      await streamPromise!.catch(() => {});
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.isStreaming).toBe(false);
  });

  it("surfaces errors via onError callback", { timeout: 10000 }, async () => {
    const onError = vi.fn();
    const sendMessage = vi
      .fn<Parameters<ChatClient["sendMessage"]>, ReturnType<ChatClient["sendMessage"]>>()
      .mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() =>
      useStreaming({
        onError,
  chatClient: { sendMessage },
      })
    );

    await act(async () => {
      await result.current.startStream(
        "/api/chat",
        { conversationId: "c" },
        handler,
        "trace",
        "source"
      );
    });

    expect(onError).toHaveBeenCalledWith("boom");
    expect(result.current.isStreaming).toBe(false);
  });
});
