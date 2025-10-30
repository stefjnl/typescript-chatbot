import { installMockLocalStorage, resetMockLocalStorage } from "@/test/__utils__/local-storage";
import type { ChatMessage, Conversation } from "@/types/chat";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useConversations } from "./use-conversations";

const CONVERSATIONS_KEY = "conversations";

function conversationStub(id: string, overrides: Partial<Conversation> = {}): Conversation {
  const timestamp = overrides.updatedAt ?? new Date().toISOString();
  return {
    id,
    title: `Conversation ${id}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: overrides.messages ?? [],
    ...overrides,
  };
}

function seed(conversations: Conversation[]): void {
  window.localStorage.setItem(
    CONVERSATIONS_KEY,
    JSON.stringify({ conversations })
  );
}

describe("useConversations", () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  afterEach(() => {
    resetMockLocalStorage();
  });

  it("creates a new conversation when storage is empty", async () => {
    const { result } = renderHook(() => useConversations());

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversation).toBeDefined();
    expect(result.current.activeConversationId).toBe(
      result.current.activeConversation?.id
    );
    expect(result.current.conversations[0].messages).toEqual([]);
  });

  it("loads existing conversations and keeps initial selection", async () => {
    const conversations = [
      conversationStub("a"),
      conversationStub("b"),
    ];
    seed(conversations);

    const { result } = renderHook(() =>
      useConversations({ initialConversationId: "b" })
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.conversations).toHaveLength(2);
    expect(result.current.activeConversationId).toBe("b");
  });

  it("updates active conversation when deleting current one", async () => {
    const conversations = [
      conversationStub("a"),
      conversationStub("b"),
    ];
    seed(conversations);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      result.current.deleteConversation("a");
    });

    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.activeConversationId).toBe("b");
  });

  it("moves conversations to front when renamed or updated", async () => {
    const conversations = [
      conversationStub("a"),
      conversationStub("b", { updatedAt: "2023-01-01T00:00:00Z" }),
    ];
    seed(conversations);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      result.current.renameConversation("b", "Renamed");
    });

    expect(result.current.conversations[0].id).toBe("b");

    const message: ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "Hi",
      timestamp: new Date().toISOString(),
    };

    await act(async () => {
      result.current.addMessage("a", message);
    });

    expect(result.current.conversations[0].id).toBe("a");

    await act(async () => {
      result.current.updateMessage("a", "msg-1", "Updated");
    });

    expect(result.current.conversations[0].id).toBe("a");
  });

  it("imports conversations and sets active conversation to the most recent", async () => {
    const existing = conversationStub("a", { updatedAt: "2023-01-01T00:00:00Z" });
    seed([existing]);

    const { result } = renderHook(() => useConversations());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const imported = conversationStub("b", { updatedAt: "2024-01-01T00:00:00Z" });

    await act(async () => {
      result.current.importData(
        JSON.stringify({ conversations: [imported, existing] })
      );
    });

    expect(result.current.conversations).toHaveLength(2);
    expect(result.current.activeConversationId).toBe("b");
  });
});
