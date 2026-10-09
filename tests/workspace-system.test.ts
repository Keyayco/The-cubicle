import {
  ConfigurationService,
  ErrorManager,
  EventBus,
  Logger,
  MemoryStorageAdapter,
  Registry,
  Runtime,
  StorageService,
} from '../src/core';
import {
  initializeWorkspaceSystem,
  WORKSPACE_COMMAND_IDS,
  WORKSPACE_SERVICE_IDS,
} from '../src/workspace';
import { describe, expect, it, vi } from 'vitest';

const createWorkspaceRuntime = async () => {
  const config = new ConfigurationService({
    runtimeOverrides: {
      storage: {
        driver: 'memory',
      },
    },
  });
  const registry = new Registry();
  const eventBus = new EventBus();
  const logger = new Logger({
    enabled: false,
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

  runtime.initialize();

  const workspace = initializeWorkspaceSystem(runtime, config.getAll());
  await workspace.ready;

  return {
    config,
    eventBus,
    registry,
    runtime,
    storage,
    workspace,
  };
};

describe('Workspace system', () => {
  it('creates workspaces and switches the active workspace', async () => {
    const { workspace } = await createWorkspaceRuntime();
    const initialWorkspaceId = workspace.stateStore.getState().activeWorkspaceId;

    const nextWorkspace = workspace.workspaceManager.createWorkspace({
      activate: true,
      name: 'Workspace 2',
    });

    expect(workspace.stateStore.getState().workspaces).toHaveLength(2);
    expect(workspace.stateStore.getState().activeWorkspaceId).toBe(nextWorkspace.id);

    workspace.workspaceManager.switchWorkspace(initialWorkspaceId as string);
    expect(workspace.stateStore.getState().activeWorkspaceId).toBe(initialWorkspaceId);
  });

  it('manages the window lifecycle and focus state', async () => {
    const { workspace } = await createWorkspaceRuntime();
    const firstWindow = workspace.windowManager.createWindow({
      title: 'Alpha',
    });
    const secondWindow = workspace.windowManager.createWindow({
      title: 'Beta',
    });

    expect(workspace.stateStore.getState().focusedWindowId).toBe(secondWindow.id);

    workspace.windowManager.focusWindow(firstWindow.id);
    expect(workspace.stateStore.getState().focusedWindowId).toBe(firstWindow.id);

    workspace.windowManager.minimizeWindow(firstWindow.id);
    expect(
      workspace.stateStore
        .getState()
        .windows.find((window) => window.id === firstWindow.id)?.mode,
    ).toBe('minimized');

    workspace.windowManager.restoreWindow(firstWindow.id);
    expect(
      workspace.stateStore
        .getState()
        .windows.find((window) => window.id === firstWindow.id)?.mode,
    ).toBe('normal');

    workspace.windowManager.maximizeWindow(secondWindow.id);
    expect(
      workspace.stateStore
        .getState()
        .windows.find((window) => window.id === secondWindow.id)?.mode,
    ).toBe('maximized');

    workspace.windowManager.closeWindow(firstWindow.id);
    expect(
      workspace.stateStore
        .getState()
        .windows.some((window) => window.id === firstWindow.id),
    ).toBe(false);
  });

  it('emits workspace, window, and layout events during lifecycle changes', async () => {
    const { eventBus, workspace } = await createWorkspaceRuntime();
    const createdListener = vi.fn();
    const changedListener = vi.fn();
    const openedWindowListener = vi.fn();
    const closedWindowListener = vi.fn();
    const layoutChangedListener = vi.fn();

    eventBus.on('workspace:created', createdListener);
    eventBus.on('workspace:changed', changedListener);
    eventBus.on('window:opened', openedWindowListener);
    eventBus.on('window:closed', closedWindowListener);
    eventBus.on('layout:changed', layoutChangedListener);

    const newWorkspace = workspace.workspaceManager.createWorkspace({
      activate: true,
      name: 'Workspace Events',
    });
    const newWindow = workspace.windowManager.createWindow({
      workspaceId: newWorkspace.id,
      title: 'Event Window',
    });

    workspace.windowManager.maximizeWindow(newWindow.id);
    workspace.windowManager.closeWindow(newWindow.id);

    expect(createdListener).toHaveBeenCalledTimes(1);
    expect(changedListener).toHaveBeenCalled();
    expect(openedWindowListener).toHaveBeenCalledTimes(1);
    expect(closedWindowListener).toHaveBeenCalledTimes(1);
    expect(layoutChangedListener).toHaveBeenCalled();
  });

  it('persists serializable workspace state through the storage service', async () => {
    const { storage, workspace } = await createWorkspaceRuntime();
    workspace.workspaceManager.createWorkspace({
      activate: true,
      name: 'Persisted Workspace',
    });
    workspace.windowManager.createWindow({
      title: 'Persisted Window',
    });

    await workspace.workspaceManager.persistState();

    const persistedState =
      await storage.read<ReturnType<typeof workspace.stateStore.getState>>(
        'workspace/session',
      );

    expect(persistedState?.workspaces.length).toBe(2);
    expect(persistedState?.windows).toHaveLength(1);
    expect(persistedState?.activeWorkspaceId).not.toBeNull();
  });

  it('registers workspace services and commands in the existing registry', async () => {
    const { registry } = await createWorkspaceRuntime();

    expect(registry.has('services', WORKSPACE_SERVICE_IDS.workspaceManager)).toBe(true);
    expect(registry.has('services', WORKSPACE_SERVICE_IDS.windowManager)).toBe(true);
    expect(registry.has('services', WORKSPACE_SERVICE_IDS.layoutManager)).toBe(true);
    expect(registry.has('services', WORKSPACE_SERVICE_IDS.commandPalette)).toBe(true);
    expect(registry.has('commands', WORKSPACE_COMMAND_IDS.openWorkspace)).toBe(true);
    expect(registry.has('commands', WORKSPACE_COMMAND_IDS.closeWorkspace)).toBe(true);
    expect(registry.has('commands', WORKSPACE_COMMAND_IDS.switchWorkspace)).toBe(true);
  });
});
