import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { fetch as crossFetch, Headers, Request, Response } from "cross-fetch";
import { webcrypto } from "node:crypto";
import { TextDecoder, TextEncoder } from "util";
import { afterEach, beforeAll, vi } from "vitest";
import "whatwg-fetch";

// Ensure fetch and related APIs are available in the test environment
if (!globalThis.fetch) {
  globalThis.fetch = crossFetch as typeof fetch;
}

if (!globalThis.Headers) {
  globalThis.Headers = Headers as typeof globalThis.Headers;
}

if (!globalThis.Request) {
  globalThis.Request = Request as typeof globalThis.Request;
}

if (!globalThis.Response) {
  globalThis.Response = Response as typeof globalThis.Response;
}

// Provide a stable crypto implementation
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
  });
}

if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = webcrypto.randomUUID.bind(webcrypto);
}

// Polyfill TextEncoder/TextDecoder for older Node environments
if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

// Stub matchMedia for components relying on it
if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeAll(() => {
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
