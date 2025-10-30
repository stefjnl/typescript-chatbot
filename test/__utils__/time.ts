import { afterEach, beforeEach, vi } from "vitest";

export function useFixedDate(isoDate: string): void {
  const fixed = new Date(isoDate);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixed);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
}
