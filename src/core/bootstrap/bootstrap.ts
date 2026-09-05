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
  type WorkspaceItem,
  WorkspaceManager,
} from '../workspace/workspace-manager';
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
  workspaceManager: WorkspaceManager;
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

const resolveRootElement = (
  config: ConfigurationService,
  container?: HTMLElement,
): HTMLElement => {
  const rootElement =
    container ??
    document.getElementById(config.getSection('workspace').rootElementId);

  if (!rootElement) {
    throw new Error('Bootstrap container could not be resolved.');
  }

  return rootElement;
};

const createDefaultWorkspaceItems = (
  config: Readonly<CubeConfig>,
): WorkspaceItem[] => [
  {
    id: 'overview',
    title: 'Overview',
    description: config.workspace.description,
    kind: 'system',
  },
  {
    id: 'runtime',
    title: 'Runtime',
    description: `Mode: ${config.environment.mode}. Logging level: ${config.logging.level}.`,
    kind: 'system',
  },
  {
    id: 'storage',
    title: 'Storage',
    description: `Driver: ${config.storage.driver}. Namespace: ${config.storage.namespace}.`,
    kind: 'system',
  },
];

/**
 * Bootstraps the Cube Phase 1 core engine and renders the root workspace.
 */
export const bootstrapApplication = (
  options?: BootstrapOptions,
): Promise<BootstrapResult> => {
  return bootstrapApplicationInternal(options);
};

const bootstrapApplicationInternal = async (
  options?: BootstrapOptions,
): Promise<BootstrapResult> => {
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
  const workspaceManager = new WorkspaceManager(eventBus, storage);
  const runtime = new Runtime({
    config,
    errorManager,
    eventBus,
    logger,
    registry,
    storage,
    workspaceManager,
  });

  runtime.initialize();

  try {
    await workspaceManager.initialize(createDefaultWorkspaceItems(config.getAll()));
    const rootElement = resolveRootElement(config, options?.container);
    renderRootWorkspace(rootElement, config.getAll(), runtime, workspaceManager);
  } catch (error) {
    const normalizedError = errorManager.capture(error, {
      source: 'bootstrap.render',
    });
    runtime.shutdown();
    throw normalizedError;
  }

  return {
    config,
    errorManager,
    eventBus,
    logger,
    registry,
    runtime,
    storage,
    workspaceManager,
  };
};
