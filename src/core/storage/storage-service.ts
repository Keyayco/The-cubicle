import type { StorageAdapter } from './storage-adapter';

/**
 * Stable storage abstraction consumed by the rest of the system.
 */
export class StorageService {
  constructor(private readonly adapter: StorageAdapter) {}

  /**
   * Persists a value under the provided key.
   */
  public save<T>(key: string, value: T): Promise<void> {
    return this.adapter.save(key, value);
  }

  /**
   * Reads a value from storage.
   */
  public read<T>(key: string): Promise<T | null> {
    return this.adapter.read(key);
  }

  /**
   * Updates an existing value using the current persisted state.
   */
  public update<T>(
    key: string,
    updater: (current: T | null) => T,
  ): Promise<T> {
    return this.adapter.update(key, updater);
  }

  /**
   * Deletes a value by key.
   */
  public delete(key: string): Promise<boolean> {
    return this.adapter.delete(key);
  }

  /**
   * Returns whether a key exists in storage.
   */
  public exists(key: string): Promise<boolean> {
    return this.adapter.exists(key);
  }

  /**
   * Clears the adapter's active namespace.
   */
  public clear(): Promise<void> {
    return this.adapter.clear();
  }
}
