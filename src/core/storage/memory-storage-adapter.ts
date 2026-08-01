import type { StorageAdapter } from './storage-adapter';

/**
 * In-memory storage adapter for tests and non-persistent runtimes.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, unknown>();

  public async save<T>(key: string, value: T): Promise<void> {
    this.store.set(key, structuredClone(value));
  }

  public async read<T>(key: string): Promise<T | null> {
    if (!this.store.has(key)) {
      return null;
    }

    return structuredClone(this.store.get(key) as T);
  }

  public async update<T>(
    key: string,
    updater: (current: T | null) => T,
  ): Promise<T> {
    const nextValue = updater(await this.read<T>(key));
    await this.save(key, nextValue);
    return nextValue;
  }

  public async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  public async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }
}
