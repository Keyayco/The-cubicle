import { CubeError, normalizeError } from '../errors/cube-error';
import type { ErrorManager } from '../errors/error-manager';
import type { EventBus } from '../events/event-bus';
import type { LoggerContract } from '../logger/types';
import type { Registry } from '../registry/registry';
import type { ConfigurationService } from '../config/config-service';
import type { CommandService } from '../commands/command-service';
import type { StorageService } from '../storage/storage-service';

export interface PluginContext {
  commands: CommandService;
  config: ConfigurationService;
  eventBus: EventBus;
  logger: LoggerContract;
  registry: Registry;
  storage: StorageService;
}

export type PluginCleanup = () => void;

/**
 * A trusted, host-provided plugin module. Activation is synchronous so plugin
 * lifecycle remains compatible with the synchronous Runtime contract.
 */
export interface PluginDefinition {
  id: string;
  activate: (context: Readonly<PluginContext>) => void | PluginCleanup;
}

export type PluginStatus =
  | 'registered'
  | 'loading'
  | 'loaded'
  | 'unloading'
  | 'failed';

interface PluginRecord {
  definition: PluginDefinition;
  status: PluginStatus;
  cleanup?: PluginCleanup;
}

export interface PluginLifecycleEvent {
  pluginId: string;
}

export interface PluginFailureEvent extends PluginLifecycleEvent {
  error: CubeError;
}

/**
 * Activates registered plugin definitions using the shared core registry.
 */
export class PluginLoader {
  constructor(
    private readonly registry: Registry,
    private readonly context: Readonly<PluginContext>,
    private readonly errorManager: ErrorManager,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerContract,
  ) {}

  /**
   * Registers a host-provided plugin definition in the central plugin registry.
   */
  public register(definition: PluginDefinition): void {
    if (
      typeof definition?.id !== 'string' ||
      definition.id.length === 0 ||
      definition.id.trim() !== definition.id ||
      typeof definition.activate !== 'function'
    ) {
      throw new CubeError('Plugin definition is invalid.', {
        code: 'PLUGIN_DEFINITION_INVALID',
        details: { pluginId: definition?.id },
      });
    }

    this.registry.register<PluginRecord>('plugins', definition.id, {
      definition: Object.freeze({
        id: definition.id,
        activate: definition.activate,
      }),
      status: 'registered',
    });
  }

  /**
   * Looks up a registered plugin definition.
   */
  public getPlugin(pluginId: string): PluginDefinition | undefined {
    return this.getRecord(pluginId)?.definition;
  }

  /**
   * Returns the current lifecycle status for a registered plugin.
   */
  public getStatus(pluginId: string): PluginStatus | undefined {
    return this.getRecord(pluginId)?.status;
  }

  /**
   * Lists the registered plugin identifiers from the central registry.
   */
  public list(): string[] {
    return this.registry.list('plugins');
  }

  /**
   * Activates one registered plugin. Repeated loads are idempotent.
   */
  public load(pluginId: string): void {
    const record = this.requireRecord(pluginId);

    if (record.status === 'loaded') {
      return;
    }

    if (record.status === 'loading' || record.status === 'unloading') {
      throw new CubeError(`Plugin "${pluginId}" is already changing state.`, {
        code: 'PLUGIN_INVALID_STATE',
        details: { pluginId, status: record.status },
      });
    }

    record.status = 'loading';

    let cleanup: void | PluginCleanup;
    try {
      cleanup = record.definition.activate(this.context);
    } catch (error) {
      record.cleanup = undefined;
      record.status = 'failed';
      const normalizedError = this.errorManager.capture(
        normalizeError(error, 'PLUGIN_LOAD_FAILED', { pluginId }),
        {
          source: 'plugin-loader.load',
          details: { pluginId },
        },
      );
      this.eventBus.emit<PluginFailureEvent>(
        'plugin:failed',
        { pluginId, error: normalizedError },
        { source: 'plugin-loader' },
      );
      throw normalizedError;
    }

    record.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
    record.status = 'loaded';
    this.logger.info('Plugin loaded.', { pluginId });
    this.eventBus.emit<PluginLifecycleEvent>(
      'plugin:loaded',
      { pluginId },
      { source: 'plugin-loader' },
    );
  }

  /**
   * Activates each registered plugin in registration order.
   */
  public loadAll(): void {
    try {
      for (const pluginId of this.list()) {
        this.load(pluginId);
      }
    } catch (error) {
      this.unloadAll();
      throw error;
    }
  }

  /**
   * Runs a plugin's cleanup and returns it to the registered state.
   */
  public unload(pluginId: string): void {
    const record = this.requireRecord(pluginId);

    if (record.status === 'registered' || record.status === 'failed') {
      return;
    }

    if (record.status === 'loading' || record.status === 'unloading') {
      throw new CubeError(`Plugin "${pluginId}" is already changing state.`, {
        code: 'PLUGIN_INVALID_STATE',
        details: { pluginId, status: record.status },
      });
    }

    record.status = 'unloading';

    try {
      record.cleanup?.();
    } catch (error) {
      record.status = 'failed';
      record.cleanup = undefined;
      const normalizedError = this.errorManager.capture(
        normalizeError(error, 'PLUGIN_UNLOAD_FAILED', { pluginId }),
        {
          source: 'plugin-loader.unload',
          details: { pluginId },
        },
      );
      this.eventBus.emit<PluginFailureEvent>(
        'plugin:failed',
        { pluginId, error: normalizedError },
        { source: 'plugin-loader' },
      );
      throw normalizedError;
    }

    record.cleanup = undefined;
    record.status = 'registered';
    this.logger.info('Plugin unloaded.', { pluginId });
    this.eventBus.emit<PluginLifecycleEvent>(
      'plugin:unloaded',
      { pluginId },
      { source: 'plugin-loader' },
    );
  }

  /**
   * Unloads loaded plugins in reverse registration order.
   *
   * A failing cleanup is reported centrally and does not prevent the remaining
   * plugins from being given a chance to clean up.
   */
  public unloadAll(): void {
    for (const pluginId of this.list().reverse()) {
      if (this.getStatus(pluginId) !== 'loaded') {
        continue;
      }

      try {
        this.unload(pluginId);
      } catch {
        // unload() has already normalized, logged, and emitted the failure.
      }
    }
  }

  private getRecord(pluginId: string): PluginRecord | undefined {
    return this.registry.get<PluginRecord>('plugins', pluginId);
  }

  private requireRecord(pluginId: string): PluginRecord {
    const record = this.getRecord(pluginId);

    if (!record) {
      throw new CubeError(`Unknown plugin "${pluginId}".`, {
        code: 'PLUGIN_NOT_FOUND',
        details: { pluginId },
      });
    }

    return record;
  }
}
