import type { ChatCompletionRequest } from "@/types/api";
import type { ChatMessage } from "@/types/chat";
import { randomUUID } from "node:crypto";

const API_BASE_URL = "https://nano-gpt.com/api/v1";
const CHAT_COMPLETIONS_PATH = "/chat/completions";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

function createAbortController(signal?: AbortSignal): AbortController {
  const controller = new AbortController();
  if (!signal) {
    return controller;
  }

  if (signal.aborted) {
    controller.abort(signal.reason);
    return controller;
  }

  const onAbort = () => controller.abort(signal.reason);
  signal.addEventListener("abort", onAbort, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => signal.removeEventListener("abort", onAbort),
    { once: true }
  );
  return controller;
}

function mapMessages(messages: ChatMessage[]): ChatCompletionRequest["messages"] {
  return [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
}

export interface NanoGPTRequestOptions {
  apiKey: string | undefined;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  traceId?: string;
}

export async function callNanoGPT({
  apiKey,
  messages,
  stream = true,
  temperature = 0.7,
  maxTokens = 10000,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  traceId,
}: NanoGPTRequestOptions): Promise<Response> {
  if (!apiKey) {
    throw Object.assign(new Error("NanoGPT API key is not configured"), {
      status: 401,
      retryable: false,
    });
  }

  const requestId = traceId ?? randomUUID();
  const startedAt = Date.now();
  const controller = createAbortController(signal);
  const timer = setTimeout(() => {
    controller.abort("Request timed out");
  }, timeoutMs);

  const payload: ChatCompletionRequest = {
    model: DEFAULT_MODEL,
    messages: mapMessages(messages),
    stream,
    temperature,
    max_tokens: maxTokens,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  };

  console.log(
    `[NanoGPT][${requestId}] Sending request`,
    {
      model: payload.model,
      max_tokens: payload.max_tokens,
      stream: payload.stream,
      messageCount: payload.messages.length,
      temperature: payload.temperature,
    }
  );

  const response = await fetch(`${API_BASE_URL}${CHAT_COMPLETIONS_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  const durationMs = Date.now() - startedAt;

  console.log(
    `[NanoGPT][${requestId}] Response received`,
    {
      status: response.status,
      statusText: response.statusText,
      durationMs,
      contentType: response.headers.get("content-type"),
      contentLength: response.headers.get("content-length"),
    }
  );

  if (!response.ok) {
    const message = await safeReadError(response);
    console.error(
      `[NanoGPT][${requestId}] Request failed`,
      {
        status: response.status,
        statusText: response.statusText,
        durationMs,
        message,
      }
    );
    const error = new Error(message);
    (error as Error & { status?: number; retryable?: boolean }).status =
      response.status;
    (error as Error & { status?: number; retryable?: boolean }).retryable =
      response.status === 429 || response.status >= 500;
    throw error;
  }

  console.log(`[NanoGPT][${requestId}] Request completed successfully`);
  return response;
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data?.error?.message) {
      return data.error.message as string;
    }
    if (data?.message) {
      return data.message as string;
    }
    return JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return `Request failed with status ${response.status}`;
    }
  }
}
