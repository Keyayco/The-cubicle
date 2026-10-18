import {
  bootstrapApplication,
  CommandService,
  ConfigurationService,
  CORE_SERVICE_IDS,
  ErrorManager,
  EventBus,
  Logger,
  MemoryStorageAdapter,
  PluginLoader,
  Registry,
  Runtime,
  type RuntimeStatusChange,
  StorageService,
  WorkspaceManager,
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
    const workspaceManager = new WorkspaceManager(eventBus, storage);
    const commandService = new CommandService(
      registry,
      eventBus,
      errorManager,
      logger,
    );
    const pluginLoader = new PluginLoader(
      registry,
      { commands: commandService, config, eventBus, logger, registry, storage },
      errorManager,
      eventBus,
      logger,
    );
    const runtime = new Runtime({
      config,
      commandService,
      errorManager,
      eventBus,
      logger,
      pluginLoader,
      registry,
      storage,
      workspaceManager,
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
  it('boots the runtime, registers core services, and renders the root workspace', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const result = await bootstrapApplication({
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });

    expect(result.runtime.getStatus()).toBe('running');
    expect(result.registry.has('services', CORE_SERVICE_IDS.runtime)).toBe(true);
    expect(result.registry.has('services', CORE_SERVICE_IDS.logger)).toBe(true);
    expect(
      result.registry.has('services', CORE_SERVICE_IDS.commandService),
    ).toBe(true);
    expect(
      result.registry.has('services', CORE_SERVICE_IDS.pluginLoader),
    ).toBe(true);
    expect(
      result.registry.has('services', CORE_SERVICE_IDS.workspaceManager),
    ).toBe(true);
    expect(result.workspaceManager.isHydrated()).toBe(true);
    expect(result.workspaceManager.listItems().map(({ id }) => id)).toEqual([
      'overview',
      'runtime',
      'storage',
    ]);
    expect(document.querySelector('.cube-root-workspace')).not.toBeNull();
    expect(document.body.textContent).toContain('Core Engine');
    expect(document.querySelector('.cube-runtime-status')?.textContent).toContain(
      'running',
    );
  });

  it('keeps the rendered workspace status synchronized with runtime lifecycle changes', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const result = await bootstrapApplication({
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

  it('unloads plugins during shutdown and reloads them on restart', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const result = await bootstrapApplication({
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });
    const activate = vi.fn();
    const cleanup = vi.fn(() =>
      result.commandService.unregister('test.lifecycle.command'),
    );

    result.pluginLoader.register({
      id: 'test.lifecycle',
      activate: ({ commands }) => {
        activate();
        commands.register({
          id: 'test.lifecycle.command',
          title: 'Lifecycle Test',
          keywords: ['test'],
          execute: () => 'active',
        });
        return cleanup;
      },
    });
    result.pluginLoader.load('test.lifecycle');
    expect(result.pluginLoader.getStatus('test.lifecycle')).toBe('loaded');
    expect(result.commandService.get('test.lifecycle.command')).toBeDefined();

    result.runtime.shutdown();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(result.pluginLoader.getStatus('test.lifecycle')).toBe('registered');
    expect(result.commandService.get('test.lifecycle.command')).toBeUndefined();

    result.runtime.restart();
    expect(activate).toHaveBeenCalledTimes(2);
    expect(result.pluginLoader.getStatus('test.lifecycle')).toBe('loaded');
    expect(result.commandService.get('test.lifecycle.command')).toBeDefined();
  });

  it('normalizes bootstrap render failures and detaches global handlers', async () => {
    document.body.innerHTML = '';

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const bootstrap = bootstrapApplication({
      runtimeOverrides: {
        logging: {
          enabled: false,
        },
        storage: {
          driver: 'memory',
        },
      },
    });

    await expect(bootstrap).rejects.toMatchObject({
      name: 'CubeError',
      message: 'Bootstrap container could not be resolved.',
      code: 'RUNTIME_ERROR',
    });

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
