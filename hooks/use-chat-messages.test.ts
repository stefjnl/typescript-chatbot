import type { ChatMessage } from "@/types/chat";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatMessages } from "./use-chat-messages";
import type { UseStreamingResult } from "./use-streaming";

describe("useChatMessages", () => {
  const baseMessage: ChatMessage = {
    id: "assistant-1",
    role: "assistant",
    content: "Existing",
    timestamp: new Date().toISOString(),
  };

  it("rejects empty messages", async () => {
    const { result } = renderHook(() =>
      useChatMessages({
        conversationId: "conversation",
        messages: [],
        addMessage: vi.fn(),
        updateMessage: vi.fn(),
        startStream: vi.fn(),
      })
    );

    await expect(result.current.sendMessage("   "))
      .rejects.toThrow("Message content cannot be empty");
  });

  it("sends user message, adds assistant stub, and streams updates", async () => {
    const addMessage = vi.fn();
    const updateMessage = vi.fn();

    const startStream = vi
      .fn(async (...args: Parameters<UseStreamingResult["startStream"]>) => {
        const [, body, handler] = args;
        const responseMessageId = (body as { responseMessageId: string }).responseMessageId;
        handler({
          conversationId: "conversation",
          messageId: responseMessageId,
          content: "Hello",
          done: false,
        });
        handler({
          conversationId: "conversation",
          messageId: responseMessageId,
          done: true,
        });
      }) as UseStreamingResult["startStream"];

    const { result } = renderHook(() =>
      useChatMessages({
        conversationId: "conversation",
        messages: [],
        addMessage,
        updateMessage,
        startStream,
      })
    );

    let sendResult: { userMessageId: string; assistantMessageId: string };

    await act(async () => {
      sendResult = await result.current.sendMessage("Hello world");
    });

    expect(addMessage).toHaveBeenCalledTimes(2);
    expect(addMessage).toHaveBeenNthCalledWith(
      1,
      "conversation",
      expect.objectContaining({ role: "user", content: "Hello world" })
    );
    expect(addMessage).toHaveBeenNthCalledWith(
      2,
      "conversation",
      expect.objectContaining({ role: "assistant", content: "" })
    );

    expect(updateMessage).toHaveBeenCalledWith(
      "conversation",
      expect.any(String),
      "Hello"
    );

    expect(startStream).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        conversationId: "conversation",
        responseMessageId: sendResult!.assistantMessageId,
      }),
      expect.any(Function),
      expect.any(String),
      "ChatMessages"
    );
  });

  it("throws when no content is streamed", async () => {
    const updateMessage = vi.fn();
    const startStream = vi
      .fn(async (...args: Parameters<UseStreamingResult["startStream"]>) => {
        const [, body, handler] = args;
        const { responseMessageId } = body as { responseMessageId: string };
        handler({
          conversationId: "conversation",
          messageId: responseMessageId,
          done: true,
        });
      }) as UseStreamingResult["startStream"];

    const { result } = renderHook(() =>
      useChatMessages({
        conversationId: "conversation",
        messages: [],
        addMessage: vi.fn(),
        updateMessage,
        startStream,
      })
    );

    await act(async () => {
      await expect(result.current.sendMessage("Hi"))
        .rejects.toThrow("No response received from the assistant");
    });

    expect(updateMessage).toHaveBeenCalledWith(
      "conversation",
      expect.any(String),
      ""
    );
  });

  it("regenerates messages and streams replacements", async () => {
    const messages: ChatMessage[] = [
      {
        id: "user-1",
        role: "user",
        content: "Prompt",
        timestamp: new Date().toISOString(),
      },
      baseMessage,
    ];

    const updateMessage = vi.fn();
    const startStream = vi
      .fn(async (...args: Parameters<UseStreamingResult["startStream"]>) => {
        const [, body, handler] = args;
        const { responseMessageId } = body as { responseMessageId: string };
        handler({
          conversationId: "conversation",
          messageId: responseMessageId,
          content: "Replacement",
          done: false,
        });
        handler({
          conversationId: "conversation",
          messageId: responseMessageId,
          done: true,
        });
      }) as UseStreamingResult["startStream"];

    const { result } = renderHook(() =>
      useChatMessages({
        conversationId: "conversation",
        messages,
        addMessage: vi.fn(),
        updateMessage,
        startStream,
      })
    );

    await act(async () => {
      await result.current.regenerateMessage(baseMessage);
    });

    expect(updateMessage).toHaveBeenNthCalledWith(
      1,
      "conversation",
      baseMessage.id,
      ""
    );
    expect(updateMessage).toHaveBeenNthCalledWith(
      2,
      "conversation",
      baseMessage.id,
      "Replacement"
    );

    expect(startStream).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({
        conversationId: "conversation",
        responseMessageId: baseMessage.id,
        signals: { regenerate: true },
      }),
      expect.any(Function),
      expect.any(String),
      "ChatMessages"
    );
  });
});
