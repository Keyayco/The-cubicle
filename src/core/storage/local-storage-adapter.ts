import type { StorageAdapter } from './storage-adapter';

/**
 * Browser localStorage adapter namespaced for Cube runtime data.
 */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(
    private readonly storage: Storage,
    private readonly namespace: string,
  ) {}

  public async save<T>(key: string, value: T): Promise<void> {
    this.storage.setItem(this.getScopedKey(key), JSON.stringify(value));
  }

  public async read<T>(key: string): Promise<T | null> {
    const value = this.storage.getItem(this.getScopedKey(key));
    return value === null ? null : (JSON.parse(value) as T);
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
    const scopedKey = this.getScopedKey(key);
    const existed = this.storage.getItem(scopedKey) !== null;
    this.storage.removeItem(scopedKey);
    return existed;
  }

  public async exists(key: string): Promise<boolean> {
    return this.storage.getItem(this.getScopedKey(key)) !== null;
  }

  public async clear(): Promise<void> {
    const keysToRemove: string[] = [];

    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);

      if (key?.startsWith(`${this.namespace}:`)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      this.storage.removeItem(key);
    }
  }

  private getScopedKey(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
