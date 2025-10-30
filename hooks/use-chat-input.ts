"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

interface UseChatInputResult {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  clearInput: () => void;
}

/**
 * Hook for managing chat input state.
 * Provides input value, setter, and clear functionality.
 */
export function useChatInput(): UseChatInputResult {
  const [input, setInput] = useState("");

  const clearInput = () => setInput("");

  return {
    input,
    setInput,
    clearInput,
  };
}
