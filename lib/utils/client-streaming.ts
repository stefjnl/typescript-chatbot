import type { SSEPayload } from "@/lib/utils/streaming";

export type SSEHandler = (payload: SSEPayload) => boolean | void;

interface TraceOptions {
  traceId?: string;
  source?: string;
}

const DEFAULT_SOURCE = "ClientSSE";

function getTracePrefix({ traceId, source }: TraceOptions = {}): string {
  const tag = source ?? DEFAULT_SOURCE;
  return traceId ? `[${tag}][${traceId}]` : `[${tag}]`;
}

export function consumeSseBuffer(
  chunk: string,
  handler: SSEHandler,
  options?: TraceOptions
): { buffer: string; completed: boolean } {
  let remaining = chunk;
  const tracePrefix = getTracePrefix(options);

  console.log(tracePrefix, "consumeSseBuffer invoked", {
    chunkLength: chunk.length,
  });

  while (true) {
    const boundary = remaining.indexOf("\n\n");
    if (boundary === -1) {
      console.log(tracePrefix, "No boundary found", {
        bufferedLength: remaining.length,
      });
      return { buffer: remaining, completed: false };
    }

    const event = remaining.slice(0, boundary);
    remaining = remaining.slice(boundary + 2);
    console.log(tracePrefix, "Processing event", {
      eventLength: event.length,
    });

    const dataLine = event
      .split("\n")
      .find((line) => line.trimStart().startsWith("data:"));
    if (!dataLine) {
      console.log(tracePrefix, "No data line in event");
      continue;
    }

    const raw = dataLine.replace(/^data:\s?/, "");
    if (!raw) {
      console.log(tracePrefix, "Empty data payload");
      continue;
    }

    try {
      console.log(tracePrefix, "Parsing SSE data", {
        preview: raw.slice(0, 200),
      });
      const payload = JSON.parse(raw) as SSEPayload;
      const shouldStop = handler(payload) === true;
      if (shouldStop) {
        console.log(tracePrefix, "Handler requested stop", payload);
        return { buffer: remaining, completed: true };
      }
      console.log(tracePrefix, "Handler consumed payload", payload);
    } catch (error) {
      console.warn(tracePrefix, "Failed to parse SSE payload", error);
      remaining = `${event}\n\n${remaining}`;
      return { buffer: remaining, completed: false };
    }
  }
}

export async function readSseStream(
  response: Response,
  handler: SSEHandler,
  options?: TraceOptions
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
  const tracePrefix = getTracePrefix(options);

  console.log(tracePrefix, "Starting SSE stream reader");

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
        console.log(tracePrefix, "Chunk received", {
          length: chunk.length,
          done,
        });
        const normalized = chunk.replace(/\r\n/g, "\n");
        const result = consumeSseBuffer(buffer + normalized, handler, options);
        buffer = result.buffer;
        completed = result.completed;
      }

      if (completed) {
        console.log(tracePrefix, "Stream completed by handler");
        await reader.cancel().catch(() => undefined);
        break;
      }

      if (done) {
        if (buffer) {
          console.log(tracePrefix, "Stream done, flushing buffer", {
            bufferLength: buffer.length,
          });
          const result = consumeSseBuffer(buffer, handler, options);
          buffer = result.buffer;
          completed = result.completed;
        }
        break;
      }
    }
  } finally {
    try {
      console.log(tracePrefix, "Releasing reader lock");
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export async function extractErrorMessage(response: Response): Promise<string> {
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
