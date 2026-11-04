import { normalizeError } from '../errors/cube-error';
import type { EventBus } from '../events/event-bus';
import type { LoggerContract } from '../logger/types';
import type { Registry } from '../registry/registry';
import type { WorkspaceManager } from '../workspace/workspace-manager';

/**
 * Runtime capabilities handed to a plugin during activation.
 */
export interface PluginContext {
  readonly pluginId: string;
  readonly eventBus: EventBus;
  readonly logger: LoggerContract;
  readonly registry: Registry;
  readonly workspace: WorkspaceManager;
}

/**
 * Lifecycle state tracked for each registered plugin.
 */
export type PluginStatus = 'registered' | 'activated' | 'deactivated' | 'error';

/**
 * Contract every Cube plugin must satisfy.
 */
export interface CubePlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(context: PluginContext): void | Promise<void>;
}

/**
 * Public, serialisable view of a registered plugin.
 */
export interface PluginDescriptor {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: PluginStatus;
}

export interface PluginFailure {
  pluginId: string;
  phase: 'activate' | 'deactivate';
  error: unknown;
}

/**
 * Registers and drives plugin lifecycles on top of the core services.
 */
export class PluginManager {
  private readonly statuses = new Map<string, PluginStatus>();

  constructor(
    private readonly registry: Registry,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerContract,
    private readonly workspace: WorkspaceManager,
  ) {}

  /**
   * Registers a plugin definition without activating it.
   */
  public register(plugin: CubePlugin): PluginDescriptor {
    if (!plugin.id.trim()) {
      throw new Error('Plugin id must be a non-empty string.');
    }

    if (this.registry.has('plugins', plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered.`);
    }

    this.registry.register('plugins', plugin.id, plugin);
    this.statuses.set(plugin.id, 'registered');

    const descriptor = this.toDescriptor(plugin);
    this.logger.debug('Plugin registered.', {
      pluginId: plugin.id,
      version: plugin.version,
    });
    this.eventBus.emit('plugin:registered', descriptor, {
      source: 'plugins',
    });

    return descriptor;
  }

  /**
   * Activates a previously registered plugin.
   */
  public async activate(pluginId: string): Promise<PluginDescriptor> {
    const plugin = this.requirePlugin(pluginId);

    if (this.statuses.get(pluginId) === 'activated') {
      return this.toDescriptor(plugin);
    }

    try {
      await plugin.activate(this.createContext(plugin));
      this.statuses.set(pluginId, 'activated');

      const descriptor = this.toDescriptor(plugin);
      this.logger.info('Plugin activated.', { pluginId });
      this.eventBus.emit('plugin:activated', descriptor, {
        source: 'plugins',
      });

      return descriptor;
    } catch (error) {
      return this.handleFailure(plugin, 'activate', error);
    }
  }

  /**
   * Deactivates an active plugin, tolerating plugins without a deactivate hook.
   */
  public async deactivate(pluginId: string): Promise<PluginDescriptor> {
    const plugin = this.requirePlugin(pluginId);

    if (this.statuses.get(pluginId) !== 'activated') {
      return this.toDescriptor(plugin);
    }

    try {
      await plugin.deactivate?.(this.createContext(plugin));
      this.statuses.set(pluginId, 'deactivated');

      const descriptor = this.toDescriptor(plugin);
      this.logger.info('Plugin deactivated.', { pluginId });
      this.eventBus.emit('plugin:deactivated', descriptor, {
        source: 'plugins',
      });

      return descriptor;
    } catch (error) {
      return this.handleFailure(plugin, 'deactivate', error);
    }
  }

  /**
   * Activates every registered plugin in registration order.
   */
  public async activateAll(): Promise<PluginDescriptor[]> {
    const activated: PluginDescriptor[] = [];

    for (const pluginId of this.registry.list('plugins')) {
      activated.push(await this.activate(pluginId));
    }

    return activated;
  }

  /**
   * Deactivates every plugin in reverse registration order.
   */
  public async deactivateAll(): Promise<void> {
    const pluginIds = [...this.registry.list('plugins')].reverse();

    for (const pluginId of pluginIds) {
      await this.deactivate(pluginId);
    }
  }

  /**
   * Lists descriptors for every registered plugin.
   */
  public list(): PluginDescriptor[] {
    return this.registry
      .list('plugins')
      .map((pluginId) => this.toDescriptor(this.requirePlugin(pluginId)));
  }

  /**
   * Retrieves a registered plugin definition.
   */
  public get(pluginId: string): CubePlugin | undefined {
    return this.registry.get<CubePlugin>('plugins', pluginId);
  }

  /**
   * Returns the tracked lifecycle status for a plugin.
   */
  public getStatus(pluginId: string): PluginStatus | undefined {
    return this.statuses.get(pluginId);
  }

  /**
   * Returns whether a plugin is currently active.
   */
  public isActive(pluginId: string): boolean {
    return this.statuses.get(pluginId) === 'activated';
  }

  private handleFailure(
    plugin: CubePlugin,
    phase: 'activate' | 'deactivate',
    error: unknown,
  ): never {
    this.statuses.set(plugin.id, 'error');

    const normalizedError = normalizeError(error, 'PLUGIN_LIFECYCLE_FAILED', {
      pluginId: plugin.id,
      phase,
    });

    this.logger.error(`Plugin ${phase} failed.`, {
      pluginId: plugin.id,
      message: normalizedError.message,
    });

    this.eventBus.emit<PluginFailure>(
      'plugin:failed',
      {
        pluginId: plugin.id,
        phase,
        error: normalizedError,
      },
      {
        source: 'plugins',
      },
    );

    throw normalizedError;
  }

  private createContext(plugin: CubePlugin): PluginContext {
    return {
      pluginId: plugin.id,
      eventBus: this.eventBus,
      logger: this.logger,
      registry: this.registry,
      workspace: this.workspace,
    };
  }

  private requirePlugin(pluginId: string): CubePlugin {
    const plugin = this.get(pluginId);

    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" is not registered.`);
    }

    return plugin;
  }

  private toDescriptor(plugin: CubePlugin): PluginDescriptor {
    return {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      status: this.statuses.get(plugin.id) ?? 'registered',
    };
  }
}
