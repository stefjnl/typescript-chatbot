class LocalStorageMock implements Storage {
  private store = new Map<string, string>();

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key) ?? null : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  get length(): number {
    return this.store.size;
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.store.entries());
  }
}

export function createLocalStorageMock(initialValues: Record<string, string> = {}): Storage {
  const mock = new LocalStorageMock();
  Object.entries(initialValues).forEach(([key, value]) => {
    mock.setItem(key, value);
  });
  return mock;
}

export function installMockLocalStorage(target: typeof globalThis = globalThis): Storage {
  const mock = createLocalStorageMock();
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    value: mock,
  });
  return mock;
}

export function resetMockLocalStorage(target: typeof globalThis = globalThis): void {
  const storage = target.localStorage;
  if (storage) {
    storage.clear();
  }
}

/**
 * Executes a test function with localStorage configured to throw errors.
 * Useful for testing error handling when localStorage is unavailable.
 * Automatically restores the original localStorage descriptor after execution.
 * 
 * @param testFn - The test function to execute with broken localStorage
 * @param errorMessage - Custom error message to throw (default: "localStorage is unavailable")
 * @param target - The global object to modify (default: globalThis)
 * 
 * @example
 * ```ts
 * it("handles localStorage errors gracefully", () => {
 *   withLocalStorageError(() => {
 *     expect(loadData()).toEqual([]);
 *   });
 * });
 * ```
 */
export function withLocalStorageError(
  testFn: () => void,
  errorMessage: string = "localStorage is unavailable",
  target: typeof globalThis = globalThis
): void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, "localStorage");
  
  try {
    Object.defineProperty(target, "localStorage", {
      configurable: true,
      get() {
        throw new Error(errorMessage);
      },
    });
    
    testFn();
  } finally {
    // Restore the original descriptor
    if (originalDescriptor) {
      Object.defineProperty(target, "localStorage", originalDescriptor);
    }
  }
}
