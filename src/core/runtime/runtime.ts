import type { ConfigurationService } from '../config/config-service';
import type { ErrorManager } from '../errors/error-manager';
import type { EventBus } from '../events/event-bus';
import type { LoggerContract } from '../logger/types';
import type { Registry } from '../registry/registry';
import type { StorageService } from '../storage/storage-service';
import { CORE_SERVICE_IDS } from './service-identifiers';

export type RuntimeStatus =
  | 'created'
  | 'initializing'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface RuntimeStatusChange {
  currentStatus: RuntimeStatus;
  previousStatus: RuntimeStatus;
}

export interface RuntimeServices {
  config: ConfigurationService;
  errorManager: ErrorManager;
  eventBus: EventBus;
  logger: LoggerContract;
  registry: Registry;
  storage: StorageService;
}

/**
 * Coordinates the Cube lifecycle and owns core service exposure.
 */
export class Runtime {
  private status: RuntimeStatus = 'created';

  constructor(private readonly services: RuntimeServices) {}

  /**
   * Returns the current lifecycle status of the runtime.
   */
  public getStatus(): RuntimeStatus {
    return this.status;
  }

  /**
   * Provides read-only access to the runtime's core services.
   */
  public getServices(): Readonly<RuntimeServices> {
    return this.services;
  }

  /**
   * Retrieves a service from the registry.
   */
  public getService<T>(identifier: string): T | undefined {
    return this.services.registry.get<T>('services', identifier);
  }

  /**
   * Starts the runtime and registers core services.
   */
  public initialize(): void {
    if (this.status === 'running' || this.status === 'initializing') {
      return;
    }

    this.transitionTo('initializing');

    try {
      this.registerCoreServices();
      this.services.errorManager.attachGlobalHandlers();
      this.transitionTo('running');
      this.services.eventBus.emit('runtime:initialized', {
        status: this.status,
      });
      this.services.logger.info('Runtime initialized.', {
        status: this.status,
      });
    } catch (error) {
      this.transitionTo('error');
      const normalizedError = this.services.errorManager.capture(error, {
        source: 'runtime.initialize',
      });
      this.services.eventBus.emit('runtime:failed', normalizedError, {
        source: 'runtime',
      });
      throw normalizedError;
    }
  }

  /**
   * Stops the runtime and detaches system-level handlers.
   */
  public shutdown(): void {
    if (this.status === 'stopping' || this.status === 'stopped') {
      return;
    }

    this.transitionTo('stopping');
    this.services.eventBus.emit('runtime:shutdown-requested', undefined, {
      source: 'runtime',
    });
    this.services.errorManager.detachGlobalHandlers();
    this.services.logger.info('Runtime shutdown complete.', {
      status: 'stopped',
    });
    this.transitionTo('stopped');
    this.services.eventBus.emit('runtime:stopped', {
      status: this.status,
    });
  }

  /**
   * Restarts the runtime in-place without rebuilding service instances.
   */
  public restart(): void {
    this.services.eventBus.emit('runtime:restart-requested', undefined, {
      source: 'runtime',
    });
    this.shutdown();
    this.initialize();
  }

  private registerCoreServices(): void {
    const services = {
      [CORE_SERVICE_IDS.config]: this.services.config,
      [CORE_SERVICE_IDS.errorManager]: this.services.errorManager,
      [CORE_SERVICE_IDS.eventBus]: this.services.eventBus,
      [CORE_SERVICE_IDS.logger]: this.services.logger,
      [CORE_SERVICE_IDS.registry]: this.services.registry,
      [CORE_SERVICE_IDS.runtime]: this,
      [CORE_SERVICE_IDS.storage]: this.services.storage,
    } as const;

    for (const [identifier, service] of Object.entries(services)) {
      if (!this.services.registry.has('services', identifier)) {
        this.services.registry.register('services', identifier, service);
      }
    }
  }

  private transitionTo(nextStatus: RuntimeStatus): void {
    if (this.status === nextStatus) {
      return;
    }

    const previousStatus = this.status;
    this.status = nextStatus;
    this.services.eventBus.emit<RuntimeStatusChange>('runtime:status-changed', {
      currentStatus: nextStatus,
      previousStatus,
    });
  }
}
