import {
  bootstrapApplication,
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
  WORKSPACE_STORAGE_KEY,
  WorkspaceManager,
  type WorkspaceItem,
  type WorkspaceState,
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
    const runtime = new Runtime({
      config,
      errorManager,
      eventBus,
      logger,
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

describe('WorkspaceManager', () => {
  it('hydrates, persists state changes, and restores them on the next load', async () => {
    const eventBus = new EventBus();
    const storage = new StorageService(new MemoryStorageAdapter());
    const workspaceManager = new WorkspaceManager(eventBus, storage);
    const eventTypes: string[] = [];
    const seedItems: WorkspaceItem[] = [
      {
        id: 'overview',
        title: 'Overview',
        description: 'Workspace overview.',
        kind: 'system',
      },
      {
        id: 'runtime',
        title: 'Runtime',
        description: 'Runtime diagnostics.',
        kind: 'system',
      },
    ];

    eventBus.on('workspace:initialized', (event) => {
      eventTypes.push(event.type);
    });
    eventBus.on('workspace:item-registered', (event) => {
      eventTypes.push(event.type);
    });
    eventBus.on('workspace:active-item-changed', (event) => {
      eventTypes.push(event.type);
    });
    eventBus.on('workspace:item-removed', (event) => {
      eventTypes.push(event.type);
    });

    await workspaceManager.initialize(seedItems);
    await workspaceManager.registerItem({
      id: 'storage',
      title: 'Storage',
      description: 'Storage status.',
      kind: 'system',
    });
    await workspaceManager.activateItem('storage');
    await workspaceManager.removeItem('runtime');

    expect(workspaceManager.isHydrated()).toBe(true);
    expect(workspaceManager.getActiveItem()?.id).toBe('storage');
    expect(workspaceManager.listItems().map((item) => item.id)).toEqual([
      'overview',
      'storage',
    ]);
    expect(eventTypes).toContain('workspace:initialized');
    expect(eventTypes).toContain('workspace:item-registered');
    expect(eventTypes).toContain('workspace:active-item-changed');
    expect(eventTypes).toContain('workspace:item-removed');

    expect(await storage.read<WorkspaceState>(WORKSPACE_STORAGE_KEY)).toEqual({
      items: [
        {
          id: 'overview',
          title: 'Overview',
          description: 'Workspace overview.',
          kind: 'system',
        },
        {
          id: 'storage',
          title: 'Storage',
          description: 'Storage status.',
          kind: 'system',
        },
      ],
      activeItemId: 'storage',
    });

    const rehydratedWorkspaceManager = new WorkspaceManager(eventBus, storage);
    await rehydratedWorkspaceManager.initialize([
      ...seedItems,
      {
        id: 'diagnostics',
        title: 'Diagnostics',
        description: 'Diagnostics panel.',
        kind: 'system',
      },
    ]);

    expect(
      rehydratedWorkspaceManager.listItems().map((item) => item.id),
    ).toEqual(['overview', 'storage', 'runtime', 'diagnostics']);
    expect(rehydratedWorkspaceManager.getActiveItem()?.id).toBe('storage');
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
      result.registry.has('services', CORE_SERVICE_IDS.workspaceManager),
    ).toBe(true);
    expect(document.querySelector('.cube-root-workspace')).not.toBeNull();
    expect(document.body.textContent).toContain('Core Engine');
    expect(document.querySelector('.cube-runtime-status')?.textContent).toContain(
      'running',
    );
    expect(document.querySelectorAll('.cube-workspace-item')).toHaveLength(3);
    expect(document.querySelector('.cube-workspace-panel h2')?.textContent).toBe(
      'Overview',
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

  it('renders workspace items and keeps the active panel synchronized', async () => {
    document.body.innerHTML = '<div id="app"></div>';

    const result = await bootstrapApplication({
      runtimeOverrides: {
        storage: {
          driver: 'memory',
        },
      },
    });

    expect(document.querySelector('.cube-workspace-panel h2')?.textContent).toBe(
      'Overview',
    );

    await result.workspaceManager.activateItem('storage');

    expect(document.querySelector('.cube-workspace-panel h2')?.textContent).toBe(
      'Storage',
    );
    expect(
      document.querySelector('[data-workspace-item-id="storage"]')?.getAttribute(
        'data-active',
      ),
    ).toBe('true');
    expect(document.querySelector('.cube-workspace-panel-meta')?.textContent).toContain(
      'Id: storage',
    );
  });

  it('normalizes bootstrap render failures and detaches global handlers', async () => {
    document.body.innerHTML = '';

    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    await expect(
      bootstrapApplication({
        runtimeOverrides: {
          logging: {
            enabled: false,
          },
          storage: {
            driver: 'memory',
          },
        },
      }),
    ).rejects.toMatchObject({
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
