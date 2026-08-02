/**
 * Storage adapter contract used by the storage service.
 */
export interface StorageAdapter {
  save<T>(key: string, value: T): Promise<void>;
  read<T>(key: string): Promise<T | null>;
  update<T>(key: string, updater: (current: T | null) => T): Promise<T>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
}
