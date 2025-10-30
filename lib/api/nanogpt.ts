import type { ChatMessage } from "@/types/chat";
import type { ChatCompletionRequest } from "@/types/api";

const API_URL = "https://nano-gpt.com/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = "MiniMax-M2";

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
}

export async function callNanoGPT({
  apiKey,
  messages,
  stream = true,
  temperature = 0.7,
  maxTokens = 2000,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: NanoGPTRequestOptions): Promise<Response> {
  if (!apiKey) {
    throw Object.assign(new Error("NanoGPT API key is not configured"), {
      status: 401,
      retryable: false,
    });
  }

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
    cache_control: {
      enabled: false,
      ttl: "5m",
    },
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!response.ok) {
    const message = await safeReadError(response);
    const error = new Error(message);
    (error as Error & { status?: number; retryable?: boolean }).status =
      response.status;
    (error as Error & { status?: number; retryable?: boolean }).retryable =
      response.status === 429 || response.status >= 500;
    throw error;
  }

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
