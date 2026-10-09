/**
 * Canonical identifiers for core runtime services.
 */
export const CORE_SERVICE_IDS = {
  commandService: 'commandService',
  config: 'config',
  errorManager: 'errorManager',
  eventBus: 'eventBus',
  logger: 'logger',
  pluginLoader: 'pluginLoader',
  registry: 'registry',
  runtime: 'runtime',
  storage: 'storage',
} as const;

export type CoreServiceId =
  (typeof CORE_SERVICE_IDS)[keyof typeof CORE_SERVICE_IDS];
