import {
  EventBus,
  MemoryStorageAdapter,
  StorageService,
  WORKSPACE_STORAGE_KEY,
  WorkspaceManager,
  type WorkspaceItem,
} from '../src/core';
import { describe, expect, it, vi } from 'vitest';

const createWorkspaceManager = () => {
  const eventBus = new EventBus();
  const storage = new StorageService(new MemoryStorageAdapter());

  return {
    eventBus,
    manager: new WorkspaceManager(eventBus, storage),
    storage,
  };
};

const overview: WorkspaceItem = {
  id: 'overview',
  title: 'Overview',
  description: 'System overview.',
  kind: 'system',
};

const runtime: WorkspaceItem = {
  id: 'runtime',
  title: 'Runtime',
  description: 'Runtime details.',
  kind: 'system',
};

describe('WorkspaceManager', () => {
  it('hydrates seeded items, selects the first item, persists state, and emits initialization', async () => {
    const { eventBus, manager, storage } = createWorkspaceManager();
    const initialized = vi.fn();
    const stateChanged = vi.fn();
    eventBus.on('workspace:initialized', initialized);
    eventBus.on('workspace:state-changed', stateChanged);

    const snapshot = await manager.initialize([overview, runtime]);

    expect(snapshot).toEqual({
      items: [overview, runtime],
      activeItemId: 'overview',
      hydrated: true,
    });
    expect(manager.getActiveItem()).toEqual(overview);
    expect(manager.isHydrated()).toBe(true);
    expect(initialized).toHaveBeenCalledTimes(1);
    expect(stateChanged).toHaveBeenCalledTimes(1);
    expect(await storage.read(WORKSPACE_STORAGE_KEY)).toEqual({
      items: [overview, runtime],
      activeItemId: 'overview',
    });
  });

  it('preserves saved items and active selection while backfilling missing seeds', async () => {
    const { manager, storage } = createWorkspaceManager();
    const savedPluginItem: WorkspaceItem = {
      id: 'plugin.notes',
      title: 'Notes',
      description: 'Plugin-provided workspace item.',
      kind: 'plugin',
    };
    await storage.save(WORKSPACE_STORAGE_KEY, {
      items: [savedPluginItem],
      activeItemId: savedPluginItem.id,
    });

    const snapshot = await manager.initialize([overview, runtime]);

    expect(snapshot.items).toEqual([savedPluginItem, overview, runtime]);
    expect(snapshot.activeItemId).toBe(savedPluginItem.id);
    expect(manager.getActiveItem()).toEqual(savedPluginItem);
    expect(await storage.read(WORKSPACE_STORAGE_KEY)).toEqual({
      items: [savedPluginItem, overview, runtime],
      activeItemId: savedPluginItem.id,
    });
  });

  it('registers, activates, removes, persists, and emits item lifecycle changes', async () => {
    const { eventBus, manager, storage } = createWorkspaceManager();
    await manager.initialize([overview, runtime]);

    const registered = vi.fn();
    const activeChanged = vi.fn();
    const removed = vi.fn();
    const stateChanged = vi.fn();
    eventBus.on('workspace:item-registered', registered);
    eventBus.on('workspace:active-item-changed', activeChanged);
    eventBus.on('workspace:item-removed', removed);
    eventBus.on('workspace:state-changed', stateChanged);

    const pluginItem: WorkspaceItem = {
      id: 'plugin.notes',
      title: 'Notes',
      description: 'Plugin-provided workspace item.',
      kind: 'plugin',
    };
    await manager.registerItem(pluginItem, { activate: true });

    expect(manager.getActiveItem()).toEqual(pluginItem);
    expect(registered).toHaveBeenCalledTimes(1);
    expect(activeChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: {
          currentItemId: 'plugin.notes',
          previousItemId: 'overview',
        },
      }),
    );

    expect(await manager.removeItem('plugin.notes')).toBe(true);
    expect(manager.getActiveItem()).toEqual(overview);
    expect(removed).toHaveBeenCalledTimes(1);
    expect(activeChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({
        payload: {
          currentItemId: 'overview',
          previousItemId: 'plugin.notes',
        },
      }),
    );
    expect(stateChanged).toHaveBeenCalledTimes(2);
    expect(await storage.read(WORKSPACE_STORAGE_KEY)).toEqual({
      items: [overview, runtime],
      activeItemId: 'overview',
    });
    expect(await manager.removeItem('missing')).toBe(false);
  });

  it('rejects duplicate and invalid items, unknown activation, and use before hydration', async () => {
    const { manager } = createWorkspaceManager();

    await expect(manager.activateItem('overview')).rejects.toMatchObject({
      code: 'WORKSPACE_MANAGER_NOT_INITIALIZED',
    });
    await expect(
      manager.initialize([
        overview,
        { ...overview },
      ]),
    ).rejects.toMatchObject({ code: 'WORKSPACE_ITEM_ALREADY_REGISTERED' });

    await manager.initialize([overview]);
    await expect(manager.registerItem(overview)).rejects.toMatchObject({
      code: 'WORKSPACE_ITEM_ALREADY_REGISTERED',
    });
    await expect(
      manager.registerItem({
        id: ' ',
        title: '',
        description: 'Invalid item.',
        kind: 'system',
      }),
    ).rejects.toMatchObject({ code: 'WORKSPACE_ITEM_INVALID' });
    await expect(manager.activateItem('unknown')).rejects.toMatchObject({
      code: 'WORKSPACE_ITEM_NOT_FOUND',
    });
  });

  it('keeps manager state isolated from mutations to returned snapshots', async () => {
    const { manager } = createWorkspaceManager();
    const snapshot = await manager.initialize([overview]);
    snapshot.items[0]!.title = 'Changed outside';
    manager.listItems()[0]!.description = 'Also changed outside';
    manager.getActiveItem()!.title = 'Changed active copy';

    expect(manager.listItems()).toEqual([overview]);
    expect(manager.getActiveItem()).toEqual(overview);
  });

  it('serializes concurrent registrations so persisted state does not lose items', async () => {
    const { manager, storage } = createWorkspaceManager();
    await manager.initialize([overview]);

    const first: WorkspaceItem = {
      id: 'plugin.first',
      title: 'First',
      description: 'First concurrent item.',
      kind: 'plugin',
    };
    const second: WorkspaceItem = {
      id: 'plugin.second',
      title: 'Second',
      description: 'Second concurrent item.',
      kind: 'plugin',
    };

    await Promise.all([
      manager.registerItem(first),
      manager.registerItem(second),
    ]);

    expect(manager.listItems()).toEqual([overview, first, second]);
    expect(await storage.read<{ items: WorkspaceItem[] }>(WORKSPACE_STORAGE_KEY))
      .toMatchObject({
        items: [overview, first, second],
      });
  });
});
