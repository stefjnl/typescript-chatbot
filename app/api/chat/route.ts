import { callNanoGPT } from "@/lib/api/nanogpt";
import { createSSEStream } from "@/lib/utils/streaming";
import type { ChatApiRequestBody } from "@/types/api";
import type { ChatMessage } from "@/types/chat";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

const MAX_INPUT_TOKENS = 4000;

function validateMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) {
    throw new Error("Invalid request: messages must be an array");
  }
  return messages.map((message) => {
    if (
      !message ||
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string"
    ) {
      throw new Error("Invalid message format");
    }

    const content = message.content.trim();
    if (!content) {
      throw new Error("Message content cannot be empty");
    }
    if (content.length > MAX_INPUT_TOKENS) {
      throw new Error("Message content exceeds maximum length");
    }

    return {
      id: String(message.id ?? crypto.randomUUID()),
      role: message.role,
      content,
      timestamp: message.timestamp ?? new Date().toISOString(),
    } satisfies ChatMessage;
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.NANOGPT_API_KEY;
  if (!apiKey) {
    return new Response("NanoGPT API key is not configured", {
      status: 500,
    });
  }

  const incomingHeaders = headers();
  const traceId = incomingHeaders.get("x-trace-id") ?? randomUUID();
  console.log(`[ChatRoute][${traceId}] Incoming chat request`);

  try {
    const body = (await request.json()) as ChatApiRequestBody;
    const messages = validateMessages(body.messages);

    console.log(`[ChatRoute][${traceId}] Request validated`, {
      conversationId: body.conversationId,
      responseMessageId: body.responseMessageId,
      messageCount: messages.length,
    });

    const response = await callNanoGPT({
      apiKey,
      messages,
      stream: true,
      traceId,
    });

  const conversationId = body.conversationId ?? crypto.randomUUID();
  const messageId = body.responseMessageId ?? crypto.randomUUID();

    console.log(`[ChatRoute][${traceId}] NanoGPT response received`, {
      status: response.status,
      contentType: response.headers.get("content-type"),
      hasBody: Boolean(response.body),
      conversationId,
      messageId,
    });

  const stream = createSSEStream(response, conversationId, messageId, traceId);
  const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "text/event-stream");
    responseHeaders.set("Cache-Control", "no-cache");
    responseHeaders.set("Connection", "keep-alive");
    responseHeaders.set("X-Trace-Id", traceId);

    console.log(`[ChatRoute][${traceId}] Streaming response to client`);

    return new Response(stream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[ChatRoute][${traceId}] Chat API error`, error);
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    const status = typeof (error as { status?: number }).status === "number"
      ? Number((error as { status?: number }).status)
      : 500;

    return new Response(
      JSON.stringify({ message }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          "X-Trace-Id": traceId,
        },
      }
    );
  }
}
