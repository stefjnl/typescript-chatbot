import { describe, expect, it, vi } from "vitest";
import { createSSEStream } from "./streaming";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createNanoResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

describe("createSSEStream", () => {
  it("forwards parsed content and emits done on [DONE]", { timeout: 10000 }, async () => {
    const parser = {
      canParse: vi.fn().mockReturnValue(true),
      parse: vi.fn().mockReturnValue({ content: "Hello", done: false }),
    };
    const response = createNanoResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      "data: [DONE]\n\n",
    ]);

    const stream = createSSEStream(response, "conversation", "message", "trace", parser);
    const reader = stream.getReader();
    const chunks: string[] = [];

    try {
      while (chunks.length < 10) { // safety limit
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    } finally {
      reader.releaseLock();
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain('"content":"Hello"');
    expect(chunks[0]).toContain('"done":false');
    expect(chunks[chunks.length - 1]).toContain('"done":true');

    expect(parser.canParse).toHaveBeenCalled();
    expect(parser.parse).toHaveBeenCalledWith('{"choices":[{"delta":{"content":"Hello"}}]}');
  });

  it("closes when parser signals completion", { timeout: 10000 }, async () => {
    const parser = {
      canParse: vi.fn().mockReturnValue(true),
      parse: vi.fn().mockReturnValue({ content: "All done", done: true }),
    };
    const response = createNanoResponse([
      'data: {"choices":[{"delta":{"content":"All done"},"finish_reason":"stop"}]}\n\n',
    ]);

    const stream = createSSEStream(response, "conversation", "message", undefined, parser);
    const reader = stream.getReader();
    const chunks: string[] = [];

    try {
      while (chunks.length < 10) { // safety limit
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    } finally {
      reader.releaseLock();
    }

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain('"content":"All done"');
    expect(chunks[chunks.length - 1]).toContain('"done":true');
  });

  it("throws when response body is missing", () => {
    const response = new Response(null);
    expect(() =>
      createSSEStream(response, "c", "m")
    ).toThrowError("NanoGPT response does not contain a body");
  });
});
