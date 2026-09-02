import { ConfigurationService, type DeepPartial } from '../config/config-service';
import type { CubeConfig, RuntimeMode } from '../config/default-config';
import { ErrorManager } from '../errors/error-manager';
import { EventBus } from '../events/event-bus';
import { Logger } from '../logger/logger';
import { Registry } from '../registry/registry';
import { Runtime } from '../runtime/runtime';
import { LocalStorageAdapter } from '../storage/local-storage-adapter';
import { MemoryStorageAdapter } from '../storage/memory-storage-adapter';
import type { StorageAdapter } from '../storage/storage-adapter';
import { StorageService } from '../storage/storage-service';
import {
  initializeWorkspaceSystem,
  type WorkspaceSystem,
} from '../../workspace';
import { renderRootWorkspace } from './root-workspace';

export interface BootstrapOptions {
  container?: HTMLElement;
  runtimeOverrides?: DeepPartial<CubeConfig>;
}

export interface BootstrapResult {
  config: ConfigurationService;
  errorManager: ErrorManager;
  eventBus: EventBus;
  logger: Logger;
  registry: Registry;
  runtime: Runtime;
  storage: StorageService;
  workspace: WorkspaceSystem;
}

const deriveEnvironmentConfig = (): DeepPartial<CubeConfig> => {
  const hasImportMeta = typeof import.meta !== 'undefined' && !!import.meta.env;
  const mode = (hasImportMeta
    ? import.meta.env.MODE
    : 'development') as RuntimeMode;
  const debug = hasImportMeta ? import.meta.env.DEV : true;

  return {
    environment: {
      mode,
      debug,
    },
    logging: {
      enabled: true,
      level: debug ? 'debug' : 'info',
    },
  };
};

const createStorageAdapter = (
  config: Readonly<CubeConfig>,
): StorageAdapter => {
  if (config.storage.driver === 'local' && typeof window !== 'undefined') {
    return new LocalStorageAdapter(window.localStorage, config.storage.namespace);
  }

  return new MemoryStorageAdapter();
};

/**
 * Bootstraps the Cube Phase 1 core engine and renders the root workspace.
 */
export const bootstrapApplication = (
  options?: BootstrapOptions,
): BootstrapResult => {
  const config = new ConfigurationService({
    environmentConfig: deriveEnvironmentConfig(),
    runtimeOverrides: options?.runtimeOverrides,
  });
  const registry = new Registry();
  const eventBus = new EventBus();
  const logger = new Logger({
    enabled: config.getSection('logging').enabled,
    level: config.getSection('logging').level,
  });
  const errorManager = new ErrorManager(logger, eventBus);
  const storage = new StorageService(createStorageAdapter(config.getAll()));
  const runtime = new Runtime({
    config,
    errorManager,
    eventBus,
    logger,
    registry,
    storage,
  });

  runtime.initialize();
  const workspace = initializeWorkspaceSystem(runtime, config.getAll());

  const rootElement =
    options?.container ??
    document.getElementById(config.getSection('workspace').rootElementId);

  if (!rootElement) {
    throw new Error('Bootstrap container could not be resolved.');
  }

  renderRootWorkspace(rootElement, config.getAll(), runtime, workspace);

  return {
    config,
    errorManager,
    eventBus,
    logger,
    registry,
    runtime,
    storage,
    workspace,
  };
};
