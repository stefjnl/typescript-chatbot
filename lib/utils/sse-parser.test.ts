import type { ChatCompletionChunk } from "@/types/api";
import { beforeEach, describe, expect, it } from "vitest";
import { NanoGPTParser } from "./sse-parser";

function buildChunk(partial: Partial<ChatCompletionChunk>): string {
  const chunk: ChatCompletionChunk = {
    id: "chunk-1",
    object: "chat.completion.chunk",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: null,
      },
    ],
    ...partial,
  };

  return JSON.stringify(chunk);
}

describe("NanoGPTParser", () => {
  let parser: NanoGPTParser;

  beforeEach(() => {
    parser = new NanoGPTParser();
  });

  it("detects JSON payloads", () => {
    expect(parser.canParse("{\"foo\":1}"))
      .toBe(true);
    expect(parser.canParse(" text"))
      .toBe(false);
  });

  it("prefers delta content fields", () => {
    const payload = buildChunk({
      choices: [
        {
          index: 0,
          delta: {
            content: "delta",
            text: "text",
            reasoning: "reasoning",
          },
          finish_reason: null,
        },
      ],
    });

    const result = parser.parse(payload);
    expect(result).toEqual({ content: "delta", done: false });
  });

  it("falls back to delta.text when content missing", () => {
    const payload = buildChunk({
      choices: [
        {
          index: 0,
          delta: {
            text: "text",
          },
          finish_reason: null,
        },
      ],
    });

    const result = parser.parse(payload);
    expect(result).toEqual({ content: "text", done: false });
  });

  it("uses reasoning delta when other fields missing", () => {
    const payload = buildChunk({
      choices: [
        {
          index: 0,
          delta: {
            reasoning: "reasoning",
          },
          finish_reason: null,
        },
      ],
    });

    const result = parser.parse(payload);
    expect(result).toEqual({ content: "reasoning", done: false });
  });

  it("falls back to message content when delta absent", () => {
    const payload = buildChunk({
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: null,
          message: {
            content: "message",
          },
        },
      ],
    });

    const result = parser.parse(payload);
    expect(result).toEqual({ content: "message", done: false });
  });

  it("marks completion when finish_reason provided", () => {
    const payload = buildChunk({
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          message: {
            content: "complete message",
          },
        },
      ],
    });

    const result = parser.parse(payload);
    expect(result).toEqual({ content: "complete message", done: true });
  });

  it("retains accumulated content until reset", () => {
    const first = buildChunk({
      choices: [
        {
          index: 0,
          delta: { content: "Hello" },
          finish_reason: null,
        },
      ],
    });
    const second = buildChunk({
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
        },
      ],
    });

    expect(parser.parse(first)).toEqual({ content: "Hello", done: false });
    expect(parser.parse(second)).toEqual({ content: undefined, done: true });

    parser.reset();
    expect(parser.parse(first)).toEqual({ content: "Hello", done: false });
  });
});
