import { DEFAULT_CONFIG, type CubeConfig } from './default-config';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepMerge = <T extends object>(
  base: T,
  override: DeepPartial<T>,
): T => {
  const result = structuredClone(base) as Record<string, unknown>;

  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }

    const current = result[key];
    result[key] =
      isObject(current) && isObject(value)
        ? deepMerge(current, value)
        : value;
  }

  return result as T;
};

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  for (const property of Object.getOwnPropertyNames(value)) {
    const nested = (value as Record<string, unknown>)[property];
    deepFreeze(nested);
  }

  return Object.freeze(value);
};

/**
 * Provides immutable, centrally managed runtime configuration.
 */
export class ConfigurationService {
  private readonly defaults: CubeConfig;

  private readonly environmentConfig: DeepPartial<CubeConfig>;

  private runtimeOverrides: DeepPartial<CubeConfig>;

  private publicConfig: Readonly<CubeConfig>;

  constructor(options?: {
    defaults?: CubeConfig;
    environmentConfig?: DeepPartial<CubeConfig>;
    runtimeOverrides?: DeepPartial<CubeConfig>;
  }) {
    this.defaults = options?.defaults ?? DEFAULT_CONFIG;
    this.environmentConfig = options?.environmentConfig ?? {};
    this.runtimeOverrides = options?.runtimeOverrides ?? {};
    this.publicConfig = this.buildConfig();
  }

  /**
   * Returns the entire immutable configuration object.
   */
  public getAll(): Readonly<CubeConfig> {
    return this.publicConfig;
  }

  /**
   * Returns a specific immutable configuration section.
   */
  public getSection<K extends keyof CubeConfig>(
    key: K,
  ): Readonly<CubeConfig[K]> {
    return this.publicConfig[key];
  }

  /**
   * Replaces the active runtime overrides and rebuilds the public snapshot.
   */
  public setRuntimeOverrides(overrides: DeepPartial<CubeConfig>): void {
    this.runtimeOverrides = deepMerge(this.runtimeOverrides, overrides);
    this.publicConfig = this.buildConfig();
  }

  private buildConfig(): Readonly<CubeConfig> {
    const merged = deepMerge(
      deepMerge(structuredClone(this.defaults) as CubeConfig, this.environmentConfig),
      this.runtimeOverrides,
    );

    return deepFreeze(merged) as Readonly<CubeConfig>;
  }
}

export type { DeepPartial };
