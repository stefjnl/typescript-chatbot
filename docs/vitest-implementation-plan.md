# Vitest Unit Test Implementation Plan

## 1. Test Infrastructure Setup

- Add `vitest`, `@vitest/coverage-istanbul`, `@testing-library/react`, `@testing-library/react-hooks` (or `@testing-library/react` v14 hooks utilities), `whatwg-fetch`, and `cross-fetch` as dev dependencies.
- Create `vitest.config.ts` with Next.js + React settings (tsx transform, alias resolution, `jsdom` environment, setup files).
- Add `test/setup.ts` to polyfill `fetch`, `crypto.randomUUID`, `TextEncoder/TextDecoder`, and mock `window.matchMedia`.
- Update `package.json` scripts: add `test`, `test:watch`, and `test:coverage` running Vitest.
- Document testing commands in `README.md`.

## 2. Shared Test Utilities

- Under `test/__utils__/`, provide helpers for:
  - Mocking `localStorage` with reset between tests.
  - Building SSE payload strings (e.g., `buildSseChunk({ content, done })`).
  - Creating fake timers defaulted to a fixed date for timestamp assertions.
- Export a reusable `mockNanoGPTResponse(chunks: string[])` to feed streams.

## 3. Storage Layer Tests (`lib/storage/conversations.ts`)

- `loadConversations` handles: empty storage, malformed JSON, normal retrieval.
- `persistConversations` writes correctly and swallows errors from quota exceptions.
- `generateTitle` truncation and fallback cases.
- `createConversation` sets IDs/timestamps/title derived from seed.
- `importConversations` merges with existing, dedupes by id, sorts by `updatedAt`, and throws on invalid payload.
- `formatTimestamp` returns formatted string and falls back to raw on invalid date.

## 4. SSE Utilities Tests

### 4.1 `lib/utils/sse-parser.ts`

- `NanoGPTParser.canParse` accepts JSON and rejects whitespace prefixed non-JSON.
- `parse` prioritizes `delta.content`, then `delta.text`, then `delta.reasoning`, finally `message.content`.
- Ensure accumulated content resets only via `reset` method.
- Validate `finish_reason` toggles `done=true` even without new deltas.

### 4.2 `lib/utils/client-streaming.ts`

- `consumeSseBuffer` processes multiple events, stops on handler `true`, and buffers partial frames.
- Handles malformed JSON by leaving the event in buffer.
- `readSseStream` stops on handler completion, drains final buffer on natural end, and throws when response not `ok` or missing body.

### 4.3 `lib/utils/streaming.ts`

- `createSSEStream` emits encoded payloads for each parsed chunk, handles `[DONE]`, and passes through custom parser results.
- Verify buffer logic for chunk boundaries and closing behavior when body ends or parser signals done.
- Include trace logging assertions via spies (ensure they are called with expected markers).

## 5. Hooks and Client Logic

### 5.1 `hooks/use-streaming.ts`

- Mock `ChatClient` to assert `startStream` sets `isStreaming`, attaches controller, cancels on handler completion, and calls `onError` on thrown error (excluding `AbortError`).
- Confirm cleanup aborts inflight request on unmount and `stopStream`.

### 5.2 `hooks/use-chat-messages.ts`

- `sendMessage` rejects blank input, adds user/assistant messages via spies, streams payload chunks to update assistant message, and raises error when no payload arrives.
- `regenerateMessage` clears existing content, filters message list, and replays stream updates to the same message ID.
- Ensure `startStream` receives trace metadata and conversation payload.

### 5.3 `hooks/use-conversations.ts`

- Initialize with existing storage, seed new conversation when empty, and maintain active selection.
- `deleteConversation` updates active ID appropriately.
- `renameConversation`, `addMessage`, `updateMessage`, `overwriteConversation` move conversations to front.
- `importData` replaces list and reassigns active conversation.

## 6. API Layer Tests

### 6.1 `lib/api/chat-client.ts`

- Default client posts to `/api/chat` with headers/body sans `traceId` and forwards abort signals.
- `MockChatClient` streams deterministic chunks.

### 6.2 `lib/api/nanogpt.ts`

- `callNanoGPT` sends system prompt + user messages, applies defaults, and propagates errors with `status`/`retryable` flags.
- Timeout path aborts request; ensure cleanup of timers.

### 6.3 `app/api/chat/route.ts`

- Isolate `validateMessages` to validate role/content/length and auto-generate IDs/timestamps.
- Route handler returns 500 when API key missing.
- With mocked `callNanoGPT`, confirm it streams success response with proper headers, and surfaces errors from validator or service call.

## 7. CI Integration

- Update project CI (if present) to run `npm run test`.
- Optionally add coverage threshold config in `vitest.config.ts`.
- Monitor flake risk (stream timing) and adjust using fake timers where needed.

## 8. Follow-up Tasks

- Evaluate end-to-end coverage once unit tests land.
- Consider adding visual regression or integration tests for chat UI separately from this effort.
