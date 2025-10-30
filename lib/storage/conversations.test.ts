import { installMockLocalStorage, resetMockLocalStorage } from "@/test/__utils__/local-storage";
import type { ChatMessage, Conversation } from "@/types/chat";
import { afterEach, beforeEach, describe, expect, it, vi, type SpyInstance } from "vitest";
import {
    appendMessage,
    createConversation,
    deleteConversation,
    exportConversations,
    findConversation,
    formatTimestamp,
    generateTitle,
    importConversations,
    loadConversations,
    persistConversations,
    replaceMessage,
    upsertConversation,
} from "./conversations";

const CONVERSATIONS_KEY = "conversations";

function seedStorage(conversations: Conversation[]): void {
  window.localStorage.setItem(
    CONVERSATIONS_KEY,
    JSON.stringify({ conversations })
  );
}

describe("conversations storage", () => {
  let consoleWarnSpy: SpyInstance;
  let consoleErrorSpy: SpyInstance;

  beforeEach(() => {
    installMockLocalStorage();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    resetMockLocalStorage();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  it("returns an empty array when localStorage is unavailable", () => {
    // Save a reference to the original localStorage
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
    
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("forbidden");
      },
    });

    expect(loadConversations()).toEqual([]);
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    
    // Restore the original descriptor
    if (originalDescriptor) {
      Object.defineProperty(window, "localStorage", originalDescriptor);
    }
  });

  it("returns an empty array when no conversations are stored", () => {
    expect(loadConversations()).toEqual([]);
  });

  it("parses stored conversations", () => {
    const conversation = createConversation({
      id: "seed",
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
    });
    seedStorage([conversation]);

    const result = loadConversations();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(conversation.id);
  });

  it("handles malformed JSON gracefully", () => {
    window.localStorage.setItem(CONVERSATIONS_KEY, "not-json");

    expect(loadConversations()).toEqual([]);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("persists conversations to localStorage", () => {
    const conversation = createConversation();
    persistConversations([conversation]);

    const stored = window.localStorage.getItem(CONVERSATIONS_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "{}")).toMatchObject({
      conversations: [expect.objectContaining({ id: conversation.id })],
    });
  });

  it("silently handles persistence failures", () => {
    const mock = installMockLocalStorage();
    vi.spyOn(mock, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    persistConversations([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("generates fallback titles", () => {
    expect(generateTitle(undefined)).toBe("New Conversation");
    expect(generateTitle("   ")).toBe("New Conversation");
  });

  it("truncates long titles", () => {
    const longMessage = "a".repeat(100);
    expect(generateTitle(longMessage)).toBe(`${"a".repeat(57)}...`);
  });

  it("creates conversations with seeded message", () => {
    const message: ChatMessage = {
      id: "message-1",
      role: "user",
      content: "test",
      timestamp: new Date().toISOString(),
    };

    const conversation = createConversation(message);
    expect(conversation.messages).toEqual([message]);
    expect(conversation.title).toBe("test");
    expect(conversation.createdAt).toBe("2024-01-01T00:00:00.000Z");
  });

  it("upserts conversations by id", () => {
    const conversation = createConversation();
    persistConversations([conversation]);

    const updated: Conversation = {
      ...conversation,
      title: "Updated",
    };

    const result = upsertConversation(updated);
    expect(result[0].title).toBe("Updated");
    expect(window.localStorage.getItem(CONVERSATIONS_KEY)).toContain("Updated");
  });

  it("appends new conversations when missing", () => {
    const conversation = createConversation();
    upsertConversation(conversation);

    const stored = loadConversations();
    expect(stored[0].id).toBe(conversation.id);
  });

  it("finds conversations by id", () => {
    const conversation = createConversation();
    persistConversations([conversation]);

    expect(findConversation(conversation.id)?.id).toBe(conversation.id);
  });

  it("deletes conversations", () => {
    const first = createConversation();
    const second = createConversation();
    persistConversations([first, second]);

    const remaining = deleteConversation(first.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("appends and replaces messages", () => {
    const conversation = createConversation();
    persistConversations([conversation]);

    const userMessage: ChatMessage = {
      id: "user-1",
      role: "user",
      content: "Hello",
      timestamp: new Date().toISOString(),
    };

    const updated = appendMessage(conversation.id, userMessage);
    expect(updated?.messages).toHaveLength(1);

    const replaced = replaceMessage(conversation.id, userMessage.id, "Hi");
    expect(replaced?.messages[0].content).toBe("Hi");
  });

  it("exports conversations with metadata", () => {
    const conversation = createConversation();
    persistConversations([conversation]);

    const exported = JSON.parse(exportConversations());
    expect(exported).toMatchObject({
      version: 1,
      conversations: [expect.objectContaining({ id: conversation.id })],
    });
  });

  it("imports conversations merging by id", () => {
    const existing = createConversation();
    const incoming = {
      ...createConversation(),
      id: existing.id,
      title: "Imported",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    seedStorage([existing]);

    const merged = importConversations(
      JSON.stringify({ conversations: [incoming] })
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe("Imported");
    expect(window.localStorage.getItem(CONVERSATIONS_KEY)).toContain("Imported");
  });

  it("throws when imported conversations are missing", () => {
    expect(() => importConversations("{}"))
      .toThrowError("Invalid file: conversations missing");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("formats timestamps and falls back on invalid input", () => {
    expect(formatTimestamp("2024-01-01T00:00:00.000Z")).toContain("2024");
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});
