# NanoGPT Streaming Request Flow

This project proxies chat requests through the Next.js API route at `app/api/chat/route.ts` and streams NanoGPT responses to the UI. The flow below documents the happy-path sequence for future reference.

1. **Client Submits Prompt**
   - `ChatInterface.tsx` collects the conversation history, filters empty assistant messages, and posts to `/api/chat` with a fresh trace ID in the `X-Trace-Id` header.
   - During streaming, the UI keeps a placeholder assistant message and updates it incrementally.

2. **Edge Route Validates Input**
   - `route.ts` verifies the request body, assigns a conversation/message ID, and logs the shared trace ID for end-to-end correlation.

3. **Proxy Calls NanoGPT**
   - `lib/api/nanogpt.ts` submits a POST to `https://nano-gpt.com/api/v1/chat/completions` using model `openai/gpt-oss-120b`, with `stream: true` and the compiled message list (system prompt included).
   - The request decorator sets a timeout, mirrors the trace ID, and records response metadata for diagnostics.

4. **Stream Transformation**
   - `lib/utils/streaming.ts` reads NanoGPT‟s SSE stream chunk-by-chunk.
   - Each payload is parsed, pulling delta text from `delta.content`, `delta.text`, or `delta.reasoning` (NanoGPT emits reasoning tokens before content).
   - Parsed tokens are converted into application-level SSE messages (`data: { conversationId, messageId, content, done }`).

5. **Client Consumption**
   - `ChatInterface.tsx` opens the SSE stream via `readSseStream`, updates the active assistant message with each chunk, and finishes once `done: true` arrives.
   - The markdown renderer renders partial content as plain text for streaming safety and switches to full Markdown (with a guarded error boundary) once the response is complete.

6. **Completion & Cleanup**
   - Both server and client close their readers, abort controllers are reset, and any accumulated errors are surfaced to the UI.

> Tip: When debugging, follow a single trace ID across client logs (`[ChatInterface][trace]`), the route handler (`[ChatRoute][trace]`), and the NanoGPT client (`[NanoGPT][trace]`) to pinpoint latency or parsing issues.
