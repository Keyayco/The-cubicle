import {
  bootstrapApplication,
  CubeError,
  ConfigurationService,
  CORE_SERVICE_IDS,
  ErrorManager,
  EventBus,
  Logger,
  MemoryStorageAdapter,
  Registry,
  Runtime,
  type RuntimeStatusChange,
  StorageService,
} from '../src/core';
import { describe, expect, it, vi } from 'vitest';

describe('EventBus', () => {
  it('prevents duplicate listener registration and supports unsubscribe', () => {
    const eventBus = new EventBus();
    const listener = vi.fn();

    const unsubscribe = eventBus.on('runtime:test', listener);
    eventBus.on('runtime:test', listener);

    expect(eventBus.listenerCount('runtime:test')).toBe(1);

    eventBus.emit('runtime:test', { value: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(eventBus.listenerCount('runtime:test')).toBe(0);
  });
});

describe('Registry', () => {
  it('registers, retrieves, verifies, lists, and unregisters objects', () => {
    const registry = new Registry();
    const service = { healthy: true };

    registry.register('services', 'health', service);

    expect(registry.get('services', 'health')).toBe(service);
    expect(registry.has('services', 'health')).toBe(true);
    expect(registry.list('services')).toEqual(['health']);

    registry.unregister('services', 'health');
    expect(registry.has('services', 'health')).toBe(false);
  });
});

describe('StorageService', () => {
  it('supports save, read, update, delete, exists, and clear', async () => {
    const storage = new StorageService(new MemoryStorageAdapter());

    await storage.save('settings', { theme: 'dark', version: 1 });
    expect(await storage.exists('settings')).toBe(true);
    expect(await storage.read<{ theme: string }>('settings')).toEqual({
      theme: 'dark',
      version: 1,
    });

    const updated = await storage.update<{ theme: string; version: number }>(
      'settings',
      (current) => ({
        theme: current?.theme ?? 'dark',
        version: (current?.version ?? 0) + 1,
      }),
    );

    expect(updated.version).toBe(2);

    await storage.delete('settings');
    expect(await storage.exists('settings')).toBe(false);

    await storage.save('temp', { value: true });
    await storage.clear();
    expect(await storage.exists('temp')).toBe(false);
  });
});

describe('Runtime', () => {
  it('emits lifecycle status changes during initialize, shutdown, and restart', () => {
    const config = new ConfigurationService();
    const registry = new Registry();
    const eventBus = new EventBus();
    const logger = new Logger({
      sink: () => undefined,
    });
    const errorManager = new ErrorManager(logger, eventBus);
    const storage = new StorageService(new MemoryStorageAdapter());
    const runtime = new Runtime({
      config,
      errorManager,
      eventBus,
      logger,
      registry,
      storage,
    });
    const observedTransitions: Array<[string, string]> = [];

    eventBus.on<RuntimeStatusChange>('runtime:status-changed', (event) => {
      if (!event.payload) {
        return;
      }

      observedTransitions.push([
        event.payload.previousStatus,
        event.payload.currentStatus,
      ]);
    });

    runtime.initialize();
    runtime.shutdown();
    runtime.restart();

    expect(observedTransitions).toEqual([
      ['created', 'initializing'],
      ['initializing', 'running'],
      ['running', 'stopping'],
      ['stopping', 'stopped'],
      ['stopped', 'initializing'],
      ['initializing', 'running'],
    ]);
    expect(runtime.getStatus()).toBe('running');
  });
});

describe('bootstrapApplication', () => {
  it('boots the runtime, registers core services, and renders the root workspace', () => {
    document.body.innerHTML = '<div id="app"></div>';

    const result = bootstrapApplication({
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });

    expect(result.runtime.getStatus()).toBe('running');
    expect(result.registry.has('services', CORE_SERVICE_IDS.runtime)).toBe(true);
    expect(result.registry.has('services', CORE_SERVICE_IDS.logger)).toBe(true);
    expect(document.querySelector('.cube-root-workspace')).not.toBeNull();
    expect(document.body.textContent).toContain('Core Engine');
    expect(document.querySelector('.cube-runtime-status')?.textContent).toContain(
      'running',
    );
  });

  it('keeps the rendered workspace status synchronized with runtime lifecycle changes', () => {
    document.body.innerHTML = '<div id="app"></div>';

    const result = bootstrapApplication({
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });

    const workspace = document.querySelector('.cube-root-workspace');
    const status = document.querySelector('.cube-runtime-status');

    expect(workspace?.getAttribute('data-runtime-status')).toBe('running');
    expect(status?.textContent).toContain('running');

    result.runtime.shutdown();

    expect(workspace?.getAttribute('data-runtime-status')).toBe('stopped');
    expect(status?.textContent).toContain('stopped');

    result.runtime.restart();

    expect(workspace?.getAttribute('data-runtime-status')).toBe('running');
    expect(status?.textContent).toContain('running');
  });

  it('normalizes bootstrap render failures and detaches global handlers', () => {
    document.body.innerHTML = '';

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    try {
      bootstrapApplication({
        runtimeOverrides: {
          logging: {
            enabled: false,
          },
          storage: {
            driver: 'memory',
          },
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CubeError);
      expect((error as CubeError).message).toBe(
        'Bootstrap container could not be resolved.',
      );
      expect((error as CubeError).code).toBe('RUNTIME_ERROR');
    }

    const addedEventTypes = addEventListenerSpy.mock.calls.map(([type]) => type);
    const removedEventTypes = removeEventListenerSpy.mock.calls.map(
      ([type]) => type,
    );

    expect(addedEventTypes).toContain('error');
    expect(addedEventTypes).toContain('unhandledrejection');
    expect(removedEventTypes).toContain('error');
    expect(removedEventTypes).toContain('unhandledrejection');
  });
});
