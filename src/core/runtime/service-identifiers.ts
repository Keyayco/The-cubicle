/**
 * Canonical identifiers for core runtime services.
 */
export const CORE_SERVICE_IDS = {
  config: 'config',
  errorManager: 'errorManager',
  eventBus: 'eventBus',
  logger: 'logger',
  registry: 'registry',
  runtime: 'runtime',
  storage: 'storage',
} as const;

export type CoreServiceId =
  (typeof CORE_SERVICE_IDS)[keyof typeof CORE_SERVICE_IDS];
