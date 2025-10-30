import { callNanoGPT } from "@/lib/api/nanogpt";
import { buildDoneEvent, buildSseChunk, mockNanoGPTResponse } from "@/test/__utils__/sse";
import type { ChatMessage } from "@/types/chat";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/api/nanogpt", () => ({
  callNanoGPT: vi.fn(),
}));

describe("POST /api/chat", () => {
  const headersMock = vi.mocked(headers);
  const callNanoGPTMock = vi.mocked(callNanoGPT);

  beforeEach(() => {
    process.env.NANOGPT_API_KEY = "secret";
    headersMock.mockReturnValue({
      get: (key: string) => (key === "x-trace-id" ? "trace" : null),
    } as unknown as Headers);
  });

  afterEach(() => {
    delete process.env.NANOGPT_API_KEY;
    callNanoGPTMock.mockReset();
  });

  function buildRequest(messages: ChatMessage[]) {
    const requestBody = {
      conversationId: "conversation",
      messages,
      responseMessageId: "assistant",
    };

    return new NextRequest("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  it("returns 500 when NanoGPT API key is missing", async () => {
    delete process.env.NANOGPT_API_KEY;
    const request = buildRequest([
      {
        id: "1",
        role: "user",
        content: "Hi",
        timestamp: new Date().toISOString(),
      },
    ]);

    const response = await POST(request);
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("NanoGPT API key is not configured");
  });

  it("rejects invalid message payloads", async () => {
    const request = buildRequest([
      {
        id: "1",
        role: "user",
        content: "   ",
        timestamp: new Date().toISOString(),
      },
    ]);

    const response = await POST(request);
    expect(response.status).toBe(500);
    const payload = JSON.parse(await response.text());
    expect(payload.message).toContain("Message content cannot be empty");
  });

  it("streams responses from NanoGPT", { timeout: 10000 }, async () => {
    const responseStream = mockNanoGPTResponse([
      buildSseChunk({ data: { id: 1 } }),
      buildDoneEvent(),
    ]);
    callNanoGPTMock.mockResolvedValue(responseStream);

    const request = buildRequest([
      {
        id: "1",
        role: "user",
        content: "Explain TypeScript",
        timestamp: new Date().toISOString(),
      },
    ]);

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(callNanoGPTMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "secret",
        messages: expect.any(Array),
        stream: true,
        traceId: "trace",
      })
    );

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    
    // Read all chunks until done with safety limit
    const chunks: Uint8Array[] = [];
    let iterations = 0;
    const maxIterations = 20;
    
    try {
      while (iterations < maxIterations) {
        const { done, value } = await reader!.read();
        if (done) break;
        if (value) chunks.push(value);
        iterations++;
      }
    } finally {
      reader!.releaseLock();
    }
    
    expect(chunks.length).toBeGreaterThan(0);
    const decoded = new TextDecoder().decode(chunks[0]);
    expect(decoded).toContain("conversation");
  });
});
