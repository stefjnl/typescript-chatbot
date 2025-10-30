"use client";

import { useRouter } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";
import { v4 as uuid } from "uuid";

import { useConversations } from "@/hooks/use-conversations";
import { readSseStream, type SSEHandler } from "@/lib/utils/client-streaming";
import type { SSEPayload } from "@/lib/utils/streaming";
import type { ChatMessage } from "@/types/chat";

interface UseChatControllerOptions {
  initialConversationId?: string;
  createNewConversation?: boolean;
}

const TRACE_SOURCE = "ChatController";

const generateTraceId = () => uuid();

type ConversationsState = ReturnType<typeof useConversations>;

export interface UseChatControllerResult {
  conversations: ConversationsState["conversations"];
  activeConversation: ConversationsState["activeConversation"];
  activeConversationId: ConversationsState["activeConversationId"];
  isReady: ConversationsState["isReady"];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isStreaming: boolean;
  error: string | null;
  placeholderMessages: ChatMessage[];
  onSendMessage: () => Promise<void>;
  onRegenerateMessage: (message: ChatMessage) => Promise<void>;
  onStopStreaming: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onImportConversations: (json: string) => void;
  renameConversation: ConversationsState["renameConversation"];
  deleteConversation: ConversationsState["deleteConversation"];
  exportData: ConversationsState["exportData"];
}

export function useChatController(
  options: UseChatControllerOptions
): UseChatControllerResult {
  const { initialConversationId, createNewConversation = false } = options;
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoCreatedConversationRef = useRef(false);

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

  const handleNewChat = useCallback(() => {
    const conversation = createConversation();
    router.push(`/chat/${conversation.id}`);
  }, [createConversation, router]);

  useEffect(() => {
    if (!createNewConversation) {
      autoCreatedConversationRef.current = false;
    }
  }, [createNewConversation]);

  useEffect(() => {
    if (
      !createNewConversation ||
      !isReady ||
      autoCreatedConversationRef.current
    ) {
      return;
    }
    handleNewChat();
    autoCreatedConversationRef.current = true;
  }, [createNewConversation, handleNewChat, isReady]);

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

    const assistantMessage: ChatMessage = {
      id: uuid(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    const validMessages = activeConversation.messages.filter(
      (msg) => msg.content.trim() !== ""
    );
    const messagesToSend = [...validMessages, userMessage];

    addMessage(activeConversation.id, userMessage);
    addMessage(activeConversation.id, assistantMessage);
    setInput("");

    const traceId = generateTraceId();
    const tracePrefix = `[${TRACE_SOURCE}][${traceId}]`;

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      console.log(tracePrefix, "Sending chat request", {
        conversationId: activeConversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        messageCount: messagesToSend.length,
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Trace-Id": traceId,
        },
        body: JSON.stringify({
          conversationId: activeConversation.id,
          messages: messagesToSend,
          responseMessageId: assistantMessage.id,
        }),
        signal: controller.signal,
      });

      console.log(tracePrefix, "Received initial response", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: {
          "content-type": response.headers.get("content-type"),
          "transfer-encoding": response.headers.get("transfer-encoding"),
        },
      });

      let partialContent = "";

      const handlePayload: SSEHandler = (payload: SSEPayload): boolean => {
        console.log(tracePrefix, "SSE payload received", payload);
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

      await readSseStream(response, handlePayload, {
        traceId,
        source: TRACE_SOURCE,
      });

      console.log(tracePrefix, "Streaming complete", {
        partialLength: partialContent.length,
        finished: partialContent !== "",
      });

      if (partialContent === "") {
        updateMessage(activeConversation.id, assistantMessage.id, "");
      }

      if (!partialContent) {
        setError("No response received from the assistant");
      }
    } catch (streamError) {
      console.error(tracePrefix, "Streaming error", streamError);
      if (
        streamError instanceof DOMException &&
        streamError.name === "AbortError"
      ) {
        setError(null);
      } else {
        setError(
          streamError instanceof Error
            ? streamError.message
            : "Failed to complete request"
        );
      }
    } finally {
      console.log(tracePrefix, "Request finished");
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

      const messagesToSend = activeConversation.messages.filter(
        (m) => m.id !== message.id && m.content.trim() !== ""
      );

      updateMessage(activeConversation.id, message.id, "");

      const traceId = generateTraceId();
      const tracePrefix = `[${TRACE_SOURCE}][${traceId}]`;

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        console.log(tracePrefix, "Regenerate request", {
          conversationId: activeConversation.id,
          messageId: message.id,
          messageCount: messagesToSend.length,
        });

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Trace-Id": traceId,
          },
          body: JSON.stringify({
            conversationId: activeConversation.id,
            messages: messagesToSend,
            responseMessageId: message.id,
            signals: { regenerate: true },
          }),
          signal: controller.signal,
        });

        console.log(tracePrefix, "Received regenerate response", {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: {
            "content-type": response.headers.get("content-type"),
            "transfer-encoding": response.headers.get("transfer-encoding"),
          },
        });

        let partialContent = "";

        const handlePayload: SSEHandler = (payload: SSEPayload): boolean => {
          console.log(tracePrefix, "Regenerate SSE payload", payload);
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

        await readSseStream(response, handlePayload, {
          traceId,
          source: TRACE_SOURCE,
        });

        console.log(tracePrefix, "Regenerate streaming complete", {
          partialLength: partialContent.length,
        });
      } catch (streamError) {
        console.error(tracePrefix, "Regenerate streaming error", streamError);
        if (
          streamError instanceof DOMException &&
          streamError.name === "AbortError"
        ) {
          setError(null);
        } else {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Failed to complete request"
          );
        }
      } finally {
        console.log(tracePrefix, "Regenerate request finished");
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
        content:
          "Ask me anything to get started. Try \"Explain TypeScript generics\".",
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

  return {
    conversations,
    activeConversation,
    activeConversationId,
    isReady,
    input,
    setInput,
    isStreaming,
    error,
    placeholderMessages,
    onSendMessage: handleSendMessage,
    onRegenerateMessage: handleRegenerate,
    onStopStreaming: handleStop,
    onCreateConversation: handleNewChat,
    onSelectConversation: handleSelectConversation,
    onImportConversations: handleImport,
    renameConversation,
    deleteConversation,
    exportData,
  };
}
