"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuid } from "uuid";
import type { ChatMessage } from "@/types/chat";
import type { SSEPayload } from "@/lib/utils/streaming";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations } from "@/hooks/use-conversations";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface ChatInterfaceProps {
  initialConversationId?: string;
  createNewConversation?: boolean;
}

export function ChatInterface({
  initialConversationId,
  createNewConversation = false,
}: ChatInterfaceProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const {
    conversations,
    activeConversation,
    activeConversationId,
    isReady,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    addMessage,
    updateMessage,
    exportData,
    importData,
  } = useConversations({ initialConversationId });

  useEffect(() => {
    if (createNewConversation && isReady) {
      handleNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createNewConversation, isReady]);

  const handleNewChat = useCallback(() => {
    const conversation = createConversation();
    router.push(`/chat/${conversation.id}`);
  }, [createConversation, router]);

  const handleStop = useCallback(() => {
    const controller = abortControllerRef.current;
    if (controller) {
      controller.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleSelectConversation = useCallback(
    (id: string) => {
      selectConversation(id);
      router.push(`/chat/${id}`);
    },
    [router, selectConversation]
  );

  const handleSendMessage = useCallback(async () => {
    if (!activeConversation) {
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    setError(null);
    setIsStreaming(true);

    const userMessage: ChatMessage = {
      id: uuid(),
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    addMessage(activeConversation.id, userMessage);
    setInput("");

    const assistantMessage: ChatMessage = {
      id: uuid(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    addMessage(activeConversation.id, assistantMessage);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          messages: [...activeConversation.messages, userMessage],
          responseMessageId: assistantMessage.id,
        }),
        signal: controller.signal,
      });

      let partialContent = "";

      const handlePayload = (payload: SSEPayload): boolean => {
        if (payload.messageId !== assistantMessage.id) {
          return false;
        }

        if (payload.content) {
          partialContent += payload.content;
          updateMessage(
            activeConversation.id,
            assistantMessage.id,
            partialContent
          );
        }

        if (payload.done) {
          return true;
        }

        return false;
      };

      await readSseStream(response, handlePayload);

      if (partialContent === "") {
        updateMessage(activeConversation.id, assistantMessage.id, "");
      }

      if (!partialContent) {
        setError("No response received from the assistant");
      }
    } catch (streamError) {
      console.error(streamError);
      if (streamError instanceof DOMException && streamError.name === "AbortError") {
        setError(null);
      } else {
        setError(
          streamError instanceof Error
            ? streamError.message
            : "Failed to complete request"
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [activeConversation, addMessage, input, updateMessage]);

  const handleRegenerate = useCallback(
    async (message: ChatMessage) => {
      if (!activeConversation) {
        return;
      }

      setIsStreaming(true);
      setError(null);

      updateMessage(activeConversation.id, message.id, "");

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConversation.id,
            messages: activeConversation.messages,
            responseMessageId: message.id,
            signals: { regenerate: true },
          }),
          signal: controller.signal,
        });

        let partialContent = "";

        const handlePayload = (payload: SSEPayload): boolean => {
          if (payload.messageId !== message.id) {
            return false;
          }

          if (payload.content) {
            partialContent += payload.content;
            updateMessage(activeConversation.id, message.id, partialContent);
          }

          if (payload.done) {
            return true;
          }

          return false;
        };

        await readSseStream(response, handlePayload);
      } catch (streamError) {
        console.error(streamError);
        if (streamError instanceof DOMException && streamError.name === "AbortError") {
          setError(null);
        } else {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Failed to complete request"
          );
        }
      } finally {
        abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [activeConversation, updateMessage]
  );

  const handleImport = useCallback(
    (json: string) => {
      try {
        importData(json);
      } catch (importError) {
        console.error(importError);
        setError("Failed to import conversations. Invalid file format.");
      }
    },
    [importData]
  );

  const placeholderMessages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "placeholder-1",
        role: "assistant",
        content: "Ask me anything to get started. Try \"Explain TypeScript generics\".",
        timestamp: new Date().toISOString(),
      },
    ],
    []
  );

  useEffect(() => {
    if (!isReady || !activeConversationId || createNewConversation) {
      return;
    }

    const targetPath = `/chat/${activeConversationId}`;
    if (window.location.pathname !== targetPath) {
      router.replace(targetPath);
    }
  }, [activeConversationId, createNewConversation, isReady, router]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background lg:flex-row">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onCreateConversation={handleNewChat}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onExport={exportData}
        onImport={handleImport}
      />
      <main className="flex h-full flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/80 px-6 py-4 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold">
              {activeConversation?.title ?? "New Conversation"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Powered by NanoGPT • Streaming responses in real time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className={buttonVariants({ variant: "outline" })}
              onClick={handleNewChat}
            >
              New chat
            </Button>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {error && (
            <div className="mx-auto mt-4 w-full max-w-2xl rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex h-full flex-col">
            {isReady ? (
              <MessageList
                messages={activeConversation?.messages ?? placeholderMessages}
                isStreaming={isStreaming}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <div className="flex flex-1 flex-col gap-4 p-6">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
          </div>
        </div>
        <Separator />
        <div className="sticky bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur">
          <MessageInput
            value={input}
            onChange={setInput}
            onSubmit={handleSendMessage}
            onStop={handleStop}
            isStreaming={isStreaming}
          />
        </div>
      </main>
    </div>
  );
}

type SSEHandler = (payload: SSEPayload) => boolean | void;

function consumeSseBuffer(
  chunk: string,
  handler: SSEHandler
): { buffer: string; completed: boolean } {
  let remaining = chunk;

  while (true) {
    const boundary = remaining.indexOf("\n\n");
    if (boundary === -1) {
      return { buffer: remaining, completed: false };
    }

    const event = remaining.slice(0, boundary);
    remaining = remaining.slice(boundary + 2);

    const dataLine = event
      .split("\n")
      .find((line) => line.trimStart().startsWith("data:"));
    if (!dataLine) {
      continue;
    }

    const raw = dataLine.replace(/^data:\s?/, "");
    if (!raw) {
      continue;
    }

    try {
      const shouldStop = handler(JSON.parse(raw) as SSEPayload) === true;
      if (shouldStop) {
        return { buffer: remaining, completed: true };
      }
    } catch (error) {
      console.warn("Failed to parse SSE payload", error);
      remaining = `${event}\n\n${remaining}`;
      return { buffer: remaining, completed: false };
    }
  }
}

async function readSseStream(
  response: Response,
  handler: SSEHandler
): Promise<void> {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  const stream = response.body;
  if (!stream) {
    throw new Error(await extractErrorMessage(response));
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      let chunk = "";

      if (value) {
        chunk = decoder.decode(value, { stream: !done });
      } else if (done) {
        chunk = decoder.decode();
      }

      if (chunk) {
        const normalized = chunk.replace(/\r\n/g, "\n");
        const result = consumeSseBuffer(buffer + normalized, handler);
        buffer = result.buffer;
        completed = result.completed;
      }

      if (completed) {
        await reader.cancel().catch(() => undefined);
        break;
      }

      if (done) {
        if (buffer) {
          const result = consumeSseBuffer(buffer, handler);
          buffer = result.buffer;
          completed = result.completed;
        }
        break;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const json = await response.clone().json();
    if (typeof json?.message === "string") {
      return json.message;
    }
    if (typeof json?.error === "string") {
      return json.error;
    }
    if (typeof json?.error?.message === "string") {
      return json.error.message;
    }
  } catch {
    // ignore JSON parse errors
  }

  try {
    const text = await response.clone().text();
    if (text) {
      return text;
    }
  } catch {
    // ignore text read errors
  }

  return `Request failed with status ${response.status}`;
}
