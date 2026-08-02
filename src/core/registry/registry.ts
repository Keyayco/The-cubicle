export type RegistryCategory = 'services' | 'plugins' | 'commands';

/**
 * Central store for system-owned registrable objects.
 */
export class Registry {
  private readonly buckets = new Map<RegistryCategory, Map<string, unknown>>([
    ['services', new Map<string, unknown>()],
    ['plugins', new Map<string, unknown>()],
    ['commands', new Map<string, unknown>()],
  ]);

  /**
   * Registers an object in the target category.
   */
  public register<T>(
    category: RegistryCategory,
    identifier: string,
    value: T,
  ): T {
    const bucket = this.getBucket(category);

    if (bucket.has(identifier)) {
      throw new Error(
        `Cannot register duplicate ${category.slice(0, -1)} "${identifier}".`,
      );
    }

    bucket.set(identifier, value);
    return value;
  }

  /**
   * Removes a registered object from the target category.
   */
  public unregister(category: RegistryCategory, identifier: string): boolean {
    return this.getBucket(category).delete(identifier);
  }

  /**
   * Retrieves a registered object by category and identifier.
   */
  public get<T>(category: RegistryCategory, identifier: string): T | undefined {
    return this.getBucket(category).get(identifier) as T | undefined;
  }

  /**
   * Returns whether an object exists in the target category.
   */
  public has(category: RegistryCategory, identifier: string): boolean {
    return this.getBucket(category).has(identifier);
  }

  /**
   * Lists all identifiers for the selected category.
   */
  public list(category: RegistryCategory): string[] {
    return [...this.getBucket(category).keys()];
  }

  /**
   * Lists all entries for the selected category.
   */
  public entries<T>(category: RegistryCategory): Array<[string, T]> {
    return [...this.getBucket(category).entries()] as Array<[string, T]>;
  }

  private getBucket(category: RegistryCategory): Map<string, unknown> {
    const bucket = this.buckets.get(category);

    if (!bucket) {
      throw new Error(`Unknown registry category "${category}".`);
    }

    return bucket;
  }
}
