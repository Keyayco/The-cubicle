import type { EventBus, LoggerContract, StorageService } from '../../core';
import type { WorkspaceStateStore } from '../state/workspace-state';
import type { WorkspaceItem, WorkspaceSystemState } from '../types';

const WORKSPACE_SESSION_STORAGE_KEY = 'workspace/session';

const createSystemId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export interface CreateWorkspaceOptions {
  id?: string;
  name?: string;
  activate?: boolean;
}

/**
 * Owns workspace lifecycle, active workspace selection, and session persistence.
 */
export class WorkspaceManager {
  private workspaceSequence = 1;

  private isRestoring = false;

  constructor(
    private readonly stateStore: WorkspaceStateStore,
    private readonly storage: StorageService,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerContract,
  ) {
    this.stateStore.subscribe(() => {
      if (!this.isRestoring) {
        void this.persistState();
      }
    });
  }

  /**
   * Returns the current serializable workspace system state.
   */
  public getState(): Readonly<WorkspaceSystemState> {
    return this.stateStore.getState();
  }

  /**
   * Creates and opens a new workspace.
   */
  public createWorkspace(options?: CreateWorkspaceOptions): WorkspaceItem {
    const timestamp = Date.now();
    const currentState = this.stateStore.getState();
    const workspace: WorkspaceItem = {
      id: options?.id ?? createSystemId('workspace'),
      name: options?.name ?? `Workspace ${this.workspaceSequence}`,
      isOpen: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.workspaceSequence += 1;

    const shouldActivate =
      options?.activate ?? currentState.activeWorkspaceId === null;

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      workspaces: [...draftState.workspaces, workspace],
      activeWorkspaceId: shouldActivate
        ? workspace.id
        : draftState.activeWorkspaceId,
    }));

    this.logger.info('Workspace created.', {
      workspaceId: workspace.id,
    });
    this.eventBus.emit('workspace:created', workspace, {
      source: 'workspace-manager',
    });
    this.eventBus.emit('workspace:opened', workspace, {
      source: 'workspace-manager',
    });

    if (shouldActivate) {
      this.eventBus.emit('workspace:changed', workspace, {
        source: 'workspace-manager',
      });
    }

    return workspace;
  }

  /**
   * Opens an existing workspace and makes it active.
   */
  public openWorkspace(workspaceId: string): WorkspaceItem {
    const currentState = this.stateStore.getState();
    const targetWorkspace = currentState.workspaces.find(
      (workspace) => workspace.id === workspaceId,
    );

    if (!targetWorkspace) {
      throw new Error(`Unknown workspace "${workspaceId}".`);
    }

    const updatedWorkspace: WorkspaceItem = {
      ...targetWorkspace,
      isOpen: true,
      updatedAt: Date.now(),
    };

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      workspaces: draftState.workspaces.map((workspace) =>
        workspace.id === workspaceId ? updatedWorkspace : workspace,
      ),
      activeWorkspaceId: workspaceId,
    }));

    this.eventBus.emit('workspace:opened', updatedWorkspace, {
      source: 'workspace-manager',
    });
    this.eventBus.emit('workspace:changed', updatedWorkspace, {
      source: 'workspace-manager',
    });

    return updatedWorkspace;
  }

  /**
   * Closes a workspace and removes any windows owned by it.
   */
  public closeWorkspace(workspaceId: string): void {
    const currentState = this.stateStore.getState();
    const targetWorkspace = currentState.workspaces.find(
      (workspace) => workspace.id === workspaceId,
    );

    if (!targetWorkspace) {
      return;
    }

    const remainingOpenWorkspaces = currentState.workspaces.filter(
      (workspace) => workspace.id !== workspaceId && workspace.isOpen,
    );
    const closedWorkspace: WorkspaceItem = {
      ...targetWorkspace,
      isOpen: false,
      updatedAt: Date.now(),
    };
    const removedWindows = currentState.windows.filter(
      (window) => window.workspaceId === workspaceId,
    );
    const nextActiveWorkspaceId =
      currentState.activeWorkspaceId === workspaceId
        ? remainingOpenWorkspaces[0]?.id ?? null
        : currentState.activeWorkspaceId;

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      workspaces: draftState.workspaces.map((workspace) =>
        workspace.id === workspaceId ? closedWorkspace : workspace,
      ),
      activeWorkspaceId: nextActiveWorkspaceId,
      windows: draftState.windows.filter((window) => window.workspaceId !== workspaceId),
      focusedWindowId:
        draftState.focusedWindowId &&
        removedWindows.some((window) => window.id === draftState.focusedWindowId)
          ? null
          : draftState.focusedWindowId,
    }));

    this.eventBus.emit('workspace:closed', closedWorkspace, {
      source: 'workspace-manager',
    });

    for (const window of removedWindows) {
      this.eventBus.emit('window:closed', window, {
        source: 'workspace-manager',
      });
    }

    if (nextActiveWorkspaceId) {
      const nextWorkspace = currentState.workspaces.find(
        (workspace) => workspace.id === nextActiveWorkspaceId,
      );

      if (nextWorkspace) {
        this.eventBus.emit('workspace:changed', nextWorkspace, {
          source: 'workspace-manager',
        });
      }
    }
  }

  /**
   * Switches the active workspace.
   */
  public switchWorkspace(workspaceId: string): void {
    const currentState = this.stateStore.getState();
    const targetWorkspace = currentState.workspaces.find(
      (workspace) => workspace.id === workspaceId && workspace.isOpen,
    );

    if (!targetWorkspace) {
      return;
    }

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      activeWorkspaceId: workspaceId,
      focusedWindowId:
        draftState.windows
          .filter((window) => window.workspaceId === workspaceId && window.isFocused)
          .sort((left, right) => right.zIndex - left.zIndex)[0]?.id ?? null,
    }));

    this.eventBus.emit('workspace:changed', targetWorkspace, {
      source: 'workspace-manager',
    });
  }

  /**
   * Cycles to the next open workspace.
   */
  public switchToNextWorkspace(): void {
    const currentState = this.stateStore.getState();
    const openWorkspaces = currentState.workspaces.filter(
      (workspace) => workspace.isOpen,
    );

    if (openWorkspaces.length <= 1) {
      return;
    }

    const currentIndex = openWorkspaces.findIndex(
      (workspace) => workspace.id === currentState.activeWorkspaceId,
    );
    const nextIndex = (currentIndex + 1) % openWorkspaces.length;

    this.switchWorkspace(openWorkspaces[nextIndex].id);
  }

  /**
   * Restores the previous session or creates the initial workspace when none exists.
   */
  public async restoreSession(): Promise<void> {
    this.isRestoring = true;

    try {
      const storedState =
        await this.storage.read<WorkspaceSystemState>(WORKSPACE_SESSION_STORAGE_KEY);

      if (storedState && storedState.workspaces.length > 0) {
        this.stateStore.replaceState(storedState);
        this.workspaceSequence = storedState.workspaces.length + 1;
        this.logger.info('Workspace session restored.', {
          workspaceCount: storedState.workspaces.length,
        });
        return;
      }

      this.createWorkspace({
        activate: true,
        name: 'Workspace 1',
      });
    } finally {
      this.isRestoring = false;
      await this.persistState();
    }
  }

  /**
   * Persists the current workspace session through the storage service.
   */
  public async persistState(): Promise<void> {
    await this.storage.save(WORKSPACE_SESSION_STORAGE_KEY, this.stateStore.getState());
  }
}
