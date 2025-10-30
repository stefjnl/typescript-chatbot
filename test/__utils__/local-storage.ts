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
