import type { ChatCompletionChunk } from "@/types/api";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export interface SSEPayload {
  conversationId: string;
  messageId: string;
  content?: string;
  done: boolean;
}

const DONE_EVENT = "[DONE]";

/**
 * Transforms the NanoGPT streaming response into a server-sent events stream.
 */
export function createSSEStream(
  response: Response,
  conversationId: string,
  messageId: string
): ReadableStream<Uint8Array> {
  if (!response.body) {
    throw new Error("NanoGPT response does not contain a body");
  }

  const reader = response.body.getReader();
  let buffer = "";
  let accumulatedContent = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encodeSse({
          conversationId,
          messageId,
          done: true,
        }));
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) {
          continue;
        }

        const payload = trimmed.replace(/^data:\s*/, "");
        if (!payload) {
          continue;
        }

        if (payload === DONE_EVENT) {
          controller.enqueue(
            encodeSse({ conversationId, messageId, done: true })
          );
          controller.close();
          reader.cancel();
          return;
        }

        try {
          const chunk = JSON.parse(payload) as ChatCompletionChunk;
          const delta =
            chunk.choices[0]?.delta?.content ??
            chunk.choices[0]?.delta?.text ??
            "";
          const messageContent = chunk.choices[0]?.message?.content ?? "";
          const finishReason = chunk.choices[0]?.finish_reason;

          let contentPiece = "";
          if (delta) {
            contentPiece = delta;
          } else if (!accumulatedContent && messageContent) {
            contentPiece = messageContent;
          }

          if (contentPiece) {
            accumulatedContent += contentPiece;
            controller.enqueue(
              encodeSse({
                conversationId,
                messageId,
                content: contentPiece,
                done: false,
              })
            );
          }

          if (finishReason) {
            if (!contentPiece && messageContent && !accumulatedContent) {
              accumulatedContent = messageContent;
              controller.enqueue(
                encodeSse({
                  conversationId,
                  messageId,
                  content: messageContent,
                  done: false,
                })
              );
            }
            controller.enqueue(
              encodeSse({ conversationId, messageId, done: true })
            );
            controller.close();
            reader.cancel();
            return;
          }
        } catch (error) {
          console.warn("Failed to parse NanoGPT chunk", error);
        }
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}

function encodeSse(payload: SSEPayload): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}
