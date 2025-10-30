"use client";

import { readSseStream, type SSEHandler } from "@/lib/utils/client-streaming";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseStreamingOptions {
  onError?: (error: string) => void;
}

export interface UseStreamingResult {
  isStreaming: boolean;
  startStream: (url: string, body: unknown, handler: SSEHandler, traceId: string, source: string) => Promise<void>;
  stopStream: () => void;
}

/**
 * Hook for managing SSE streaming state and lifecycle.
 * Handles abort controllers, streaming state, and error handling.
 */
export function useStreaming(options: UseStreamingOptions = {}): UseStreamingResult {
  const { onError } = options;
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const stopStream = useCallback(() => {
    const controller = abortControllerRef.current;
    if (controller) {
      controller.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(
    async (
      url: string,
      body: unknown,
      handler: SSEHandler,
      traceId: string,
      source: string
    ): Promise<void> => {
      const tracePrefix = `[${source}][${traceId}]`;
      setIsStreaming(true);

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        console.log(tracePrefix, "Starting stream request", {
          url,
          bodyKeys: Object.keys(body as Record<string, unknown>),
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Trace-Id": traceId,
          },
          body: JSON.stringify(body),
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

        await readSseStream(response, handler, {
          traceId,
          source,
        });

        console.log(tracePrefix, "Streaming complete");
      } catch (streamError) {
        console.error(tracePrefix, "Streaming error", streamError);
        
        // Don't treat abort as an error
        if (
          streamError instanceof DOMException &&
          streamError.name === "AbortError"
        ) {
          return;
        }

        const errorMessage =
          streamError instanceof Error
            ? streamError.message
            : "Failed to complete request";
        
        onError?.(errorMessage);
      } finally {
        console.log(tracePrefix, "Request finished");
        abortControllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [onError]
  );

  return {
    isStreaming,
    startStream,
    stopStream,
  };
}
