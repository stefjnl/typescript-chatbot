import { buildSseChunk, mockNanoGPTResponse } from "@/test/__utils__/sse";
import { describe, expect, it, vi } from "vitest";
import { consumeSseBuffer, readSseStream } from "./client-streaming";
import type { SSEPayload } from "./streaming";

describe("consumeSseBuffer", () => {
  it("processes complete events and returns remaining buffer", () => {
    const handler = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const first = buildSseChunk({
      data: {
        conversationId: "1",
        messageId: "2",
        content: "Hello",
        done: false,
      } satisfies SSEPayload,
    });
    const second = buildSseChunk({
      data: {
        conversationId: "1",
        messageId: "2",
        done: true,
      } satisfies SSEPayload,
    });
    const chunk = `${first}${second}partial`;

    const result = consumeSseBuffer(chunk, handler);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(result.completed).toBe(true);
    expect(result.buffer).toBe("partial");
  });

  it("returns original buffer when boundary missing", () => {
    const handler = vi.fn();
    const result = consumeSseBuffer("data: {", handler);

    expect(handler).not.toHaveBeenCalled();
    expect(result.completed).toBe(false);
    expect(result.buffer).toBe("data: {");
  });

  it("preserves buffer on malformed JSON", () => {
    const handler = vi.fn();
    const chunk = "data: {invalid}\n\n";
    const result = consumeSseBuffer(chunk, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(result.completed).toBe(false);
    expect(result.buffer).toContain("{invalid}");
  });
});

describe("readSseStream", () => {
  it("invokes handler for streamed events until completion", async () => {
    const payloads: SSEPayload[] = [];
    const response = mockNanoGPTResponse([
      buildSseChunk({
        data: {
          conversationId: "1",
          messageId: "a",
          content: "Hello",
          done: false,
        },
      }),
      buildSseChunk({
        data: {
          conversationId: "1",
          messageId: "a",
          done: true,
        },
      }),
    ]);

    const handler = vi.fn((payload: SSEPayload) => {
      payloads.push(payload);
      return payload.done;
    });

    await readSseStream(response, handler, { traceId: "trace", source: "test" });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(payloads).toEqual([
      expect.objectContaining({ content: "Hello", done: false }),
      expect.objectContaining({ done: true }),
    ]);
  });

  it("throws an error when response is not ok", async () => {
    const response = new Response(JSON.stringify({ message: "failure" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });

    await expect(readSseStream(response, vi.fn()))
      .rejects.toThrow("failure");
  });
});
