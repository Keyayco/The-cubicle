import type { CubeConfig } from '../core/config/default-config';
import type { Runtime } from '../core/runtime/runtime';
import { registerWorkspaceCommands } from './commands/register-workspace-commands';
import { LayoutManager } from './layout/layout-manager';
import { WORKSPACE_SERVICE_IDS } from './service-identifiers';
import { WorkspaceStateStore } from './state/workspace-state';
import { CommandPalette } from './ui/command-palette';
import { WindowManager } from './windows/window-manager';
import { WorkspaceManager } from './workspaces/workspace-manager';

export interface WorkspaceSystem {
  commandPalette: CommandPalette;
  layoutManager: LayoutManager;
  ready: Promise<void>;
  stateStore: WorkspaceStateStore;
  windowManager: WindowManager;
  workspaceManager: WorkspaceManager;
}

/**
 * Builds and registers the Phase 2 workspace system on top of the core runtime.
 */
export const initializeWorkspaceSystem = (
  runtime: Runtime,
  config: Readonly<CubeConfig>,
): WorkspaceSystem => {
  const { eventBus, logger, registry, storage } = runtime.getServices();
  const stateStore = new WorkspaceStateStore({
    workspaces: [],
    activeWorkspaceId: null,
    windows: [],
    focusedWindowId: null,
    layout: {
      nextZIndex: 1,
      defaultWindowBounds: {
        x: 48,
        y: 48,
        width: Math.max(320, Math.round(config.workspace.windowWidth)),
        height: Math.max(240, Math.round(config.workspace.windowHeight)),
      },
      dockRegions: ['none', 'left', 'right', 'bottom'],
    },
  });
  const layoutManager = new LayoutManager(eventBus);
  const workspaceManager = new WorkspaceManager(
    stateStore,
    storage,
    eventBus,
    logger,
  );
  const windowManager = new WindowManager(
    stateStore,
    layoutManager,
    eventBus,
    logger,
  );
  const commandPalette = new CommandPalette(registry, eventBus);

  if (!registry.has('services', WORKSPACE_SERVICE_IDS.workspaceState)) {
    registry.register('services', WORKSPACE_SERVICE_IDS.workspaceState, stateStore);
  }

  if (!registry.has('services', WORKSPACE_SERVICE_IDS.layoutManager)) {
    registry.register('services', WORKSPACE_SERVICE_IDS.layoutManager, layoutManager);
  }

  if (!registry.has('services', WORKSPACE_SERVICE_IDS.workspaceManager)) {
    registry.register(
      'services',
      WORKSPACE_SERVICE_IDS.workspaceManager,
      workspaceManager,
    );
  }

  if (!registry.has('services', WORKSPACE_SERVICE_IDS.windowManager)) {
    registry.register('services', WORKSPACE_SERVICE_IDS.windowManager, windowManager);
  }

  if (!registry.has('services', WORKSPACE_SERVICE_IDS.commandPalette)) {
    registry.register(
      'services',
      WORKSPACE_SERVICE_IDS.commandPalette,
      commandPalette,
    );
  }

  registerWorkspaceCommands(registry, {
    createWorkspace: () => {
      workspaceManager.createWorkspace({
        activate: true,
      });
    },
    closeActiveWorkspace: () => {
      const activeWorkspaceId = stateStore.getState().activeWorkspaceId;

      if (activeWorkspaceId) {
        workspaceManager.closeWorkspace(activeWorkspaceId);
      }
    },
    switchWorkspace: () => {
      workspaceManager.switchToNextWorkspace();
    },
  });

  return {
    commandPalette,
    layoutManager,
    ready: workspaceManager.restoreSession(),
    stateStore,
    windowManager,
    workspaceManager,
  };
};
