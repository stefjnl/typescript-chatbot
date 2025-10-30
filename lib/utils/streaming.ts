import { NanoGPTParser, type SSEParser } from "@/lib/utils/sse-parser";

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
 * Now supports custom parsers for extensibility (Open/Closed Principle).
 */
export function createSSEStream(
  response: Response,
  conversationId: string,
  messageId: string,
  traceId?: string,
  parser: SSEParser = new NanoGPTParser()
): ReadableStream<Uint8Array> {
  if (!response.body) {
    throw new Error("NanoGPT response does not contain a body");
  }

  const reader = response.body.getReader();
  let buffer = "";
  const logPrefix = traceId ? `[SSE][${traceId}]` : "[SSE]";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      console.log(
        `${logPrefix} reader.read()`,
        {
          done,
          valueLength: value?.length ?? 0,
          bufferLength: buffer.length,
        }
      );
      
      if (done) {
        console.log(`${logPrefix} stream ended by NanoGPT`);
        console.log(`${logPrefix} remaining buffer length`, buffer.length);
        if (buffer.length > 0) {
          console.log(
            `${logPrefix} WARNING unused buffer preview`,
            buffer.substring(0, 200)
          );
        }
        controller.enqueue(encodeSse({
          conversationId,
          messageId,
          done: true,
        }));
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      console.log(`${logPrefix} buffer length after decode`, buffer.length);
      
      // Process complete SSE events from the buffer
      while (true) {
        // Look for "data:" prefix to start an event
        const dataIndex = buffer.indexOf("data:");
        if (dataIndex === -1) {
          console.log(`${logPrefix} no complete event detected`, {
            bufferLength: buffer.length,
          });
          // No more events in buffer
          break;
        }

        // Find the end of this event (double newline after the data line)
        // But we need to be careful: the JSON might contain \n\n
        // So we look for \n\n that comes after a complete JSON object
        const searchStart = dataIndex + 5; // after "data:"
        let eventEnd = -1;
        let jsonStart = searchStart;
        
        // Skip whitespace after "data:"
        while (jsonStart < buffer.length && /\s/.test(buffer[jsonStart])) {
          jsonStart++;
        }

        // Check for [DONE] marker or other non-JSON payloads
        const remainingAfterData = buffer.slice(jsonStart);
        const nextNewline = remainingAfterData.indexOf('\n');
        
        // If we find \n\n after the data line, it's a complete event (even if not JSON)
        if (nextNewline !== -1) {
          const potentialEnd = jsonStart + nextNewline;
          if (potentialEnd + 1 < buffer.length && buffer[potentialEnd + 1] === '\n') {
            // Found \n\n, this is a complete event
            eventEnd = potentialEnd + 2;
          }
        }

        // Try to find a complete JSON object only if not already found
        if (eventEnd === -1 && jsonStart < buffer.length && buffer[jsonStart] === '{') {
          let depth = 0;
          let inString = false;
          let escaped = false;
          let i = jsonStart;

          for (; i < buffer.length; i++) {
            const char = buffer[i];
            
            if (escaped) {
              escaped = false;
              continue;
            }

            if (char === '\\' && inString) {
              escaped = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === '{') {
                depth++;
              } else if (char === '}') {
                depth--;
                if (depth === 0) {
                  // Found complete JSON object, now look for \n\n after it
                  eventEnd = i + 1;
                  // Skip to the double newline
                  while (eventEnd < buffer.length && buffer[eventEnd] !== '\n') {
                    eventEnd++;
                  }
                  if (eventEnd < buffer.length && buffer[eventEnd] === '\n') {
                    eventEnd++;
                    if (eventEnd < buffer.length && buffer[eventEnd] === '\n') {
                      eventEnd++;
                    }
                  }
                  break;
                }
              }
            }
          }
        }

        if (eventEnd === -1) {
          // Incomplete JSON in buffer, wait for more data
          console.log(`${logPrefix} incomplete JSON detected`, {
            bufferLength: buffer.length,
            preview: buffer.substring(0, 150),
          });
          // But trim any data before dataIndex to save memory
          if (dataIndex > 0) {
            buffer = buffer.slice(dataIndex);
          }
          break;
        }

        // Extract the complete event
        const eventText = buffer.slice(dataIndex, eventEnd);
        buffer = buffer.slice(eventEnd);
        console.log(`${logPrefix} extracted event`, {
          eventLength: eventText.length,
        });
        
        // Skip any trailing whitespace/newlines before next event
        while (buffer.length > 0 && /[\r\n]/.test(buffer[0])) {
          buffer = buffer.slice(1);
        }

        // Parse the data line
        const dataPrefix = eventText.indexOf("data:");
        const payload = eventText.slice(dataPrefix + 5).trim();
        
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
          console.log(`${logPrefix} parsing SSE payload`, {
            payloadLength: payload.length,
            previewStart: payload.substring(0, 100),
            previewEnd: payload.substring(Math.max(0, payload.length - 100)),
          });
          
          // Use the parser to extract content and done status
          if (!parser.canParse(payload)) {
            console.warn(`${logPrefix} parser cannot handle payload format`);
            continue;
          }

          const result = parser.parse(payload);
          
          console.log(`${logPrefix} payload extracted`, {
            hasContent: Boolean(result.content),
            contentPreview: result.content?.slice(0, 200) ?? "",
            done: result.done,
          });

          if (result.content) {
            console.log(`${logPrefix} forwarding content piece`, {
              length: result.content.length,
            });
            controller.enqueue(
              encodeSse({
                conversationId,
                messageId,
                content: result.content,
                done: false,
              })
            );
          }

          if (result.done) {
            console.log(`${logPrefix} stream ending via finish_reason`);
            controller.enqueue(
              encodeSse({ conversationId, messageId, done: true })
            );
            controller.close();
            reader.cancel();
            return;
          }
        } catch (error) {
          console.warn(`${logPrefix} failed to parse NanoGPT chunk`, error);
        }
      }
    },
    cancel(reason) {
      console.log(`${logPrefix} stream cancelled`, reason);
      void reader.cancel(reason);
    },
  });
}

function encodeSse(payload: SSEPayload): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}
