const encoder = new TextEncoder();

export interface BuildSseChunkOptions {
  data: unknown;
  event?: string;
}

export function buildSseChunk({ data, event }: BuildSseChunkOptions): string {
  const lines: string[] = [];
  if (event) {
    lines.push(`event: ${event}`);
  }
  lines.push(`data: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return `${lines.join("\n")}\n\n`;
}

export function buildDoneEvent(): string {
  return "data: [DONE]\n\n";
}

export function mockNanoGPTResponse(chunks: string[], init?: ResponseInit): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => {
        controller.enqueue(encoder.encode(chunk));
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      ...init?.headers,
    },
    status: init?.status ?? 200,
    statusText: init?.statusText,
  });
}
