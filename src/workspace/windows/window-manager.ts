import type { EventBus, LoggerContract } from '../../core';
import type { LayoutManager } from '../layout/layout-manager';
import type { WorkspaceStateStore } from '../state/workspace-state';
import type { WindowBounds, WindowItem, WorkspaceItem } from '../types';

const DEFAULT_MAXIMIZED_BOUNDS: WindowBounds = {
  x: 0,
  y: 0,
  width: 960,
  height: 640,
};

const createSystemId = (prefix: string): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export interface CreateWindowOptions {
  workspaceId?: string;
  title?: string;
}

/**
 * Manages generic workspace window lifecycle and focus behavior.
 */
export class WindowManager {
  private windowSequence = 1;

  constructor(
    private readonly stateStore: WorkspaceStateStore,
    private readonly layoutManager: LayoutManager,
    private readonly eventBus: EventBus,
    private readonly logger: LoggerContract,
  ) {}

  /**
   * Creates a new generic window for the target workspace.
   */
  public createWindow(options?: CreateWindowOptions): WindowItem {
    const currentState = this.stateStore.getState();
    const workspace = this.resolveWorkspace(options?.workspaceId);
    const activeWorkspaceWindows = currentState.windows.filter(
      (window) => window.workspaceId === workspace.id,
    );
    const layout = this.layoutManager.createWindowLayout(
      activeWorkspaceWindows.length,
      currentState.layout.defaultWindowBounds,
    );
    const timestamp = Date.now();
    const nextWindow: WindowItem = {
      id: createSystemId('window'),
      workspaceId: workspace.id,
      title: options?.title ?? `Window ${this.windowSequence}`,
      mode: 'normal',
      zIndex: currentState.layout.nextZIndex,
      isFocused: true,
      createdAt: timestamp,
      updatedAt: timestamp,
      layout,
    };

    this.windowSequence += 1;

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      activeWorkspaceId: workspace.id,
      focusedWindowId: nextWindow.id,
      windows: [
        ...draftState.windows.map((window) => ({
          ...window,
          isFocused: false,
        })),
        nextWindow,
      ],
      layout: {
        ...draftState.layout,
        nextZIndex: draftState.layout.nextZIndex + 1,
      },
    }));

    this.logger.info('Window opened.', {
      windowId: nextWindow.id,
      workspaceId: workspace.id,
    });
    this.eventBus.emit('window:opened', nextWindow, {
      source: 'window-manager',
    });
    this.eventBus.emit('window:focused', nextWindow, {
      source: 'window-manager',
    });

    return nextWindow;
  }

  /**
   * Closes a window and reapplies focus to the next highest z-index window.
   */
  public closeWindow(windowId: string): void {
    const currentState = this.stateStore.getState();
    const targetWindow = currentState.windows.find((window) => window.id === windowId);

    if (!targetWindow) {
      return;
    }

    const remainingWindows = currentState.windows.filter(
      (window) => window.id !== windowId,
    );
    const nextFocusedWindow = remainingWindows
      .filter((window) => window.workspaceId === targetWindow.workspaceId)
      .sort((left, right) => right.zIndex - left.zIndex)[0];

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      windows: draftState.windows
        .filter((window) => window.id !== windowId)
        .map((window) => ({
          ...window,
          isFocused: nextFocusedWindow?.id === window.id,
        })),
      focusedWindowId: nextFocusedWindow?.id ?? null,
    }));

    this.eventBus.emit('window:closed', targetWindow, {
      source: 'window-manager',
    });

    if (nextFocusedWindow) {
      this.eventBus.emit('window:focused', nextFocusedWindow, {
        source: 'window-manager',
      });
    }
  }

  /**
   * Minimizes a window and clears focus from it.
   */
  public minimizeWindow(windowId: string): void {
    const currentState = this.stateStore.getState();
    const targetWindow = currentState.windows.find((window) => window.id === windowId);

    if (!targetWindow) {
      return;
    }

    const nextWindow = this.layoutManager.minimizeWindow(targetWindow);
    const nextFocusedWindow = currentState.windows
      .filter(
        (window) =>
          window.id !== windowId &&
          window.workspaceId === targetWindow.workspaceId &&
          window.mode !== 'minimized',
      )
      .sort((left, right) => right.zIndex - left.zIndex)[0];

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      windows: draftState.windows.map((window) => {
        if (window.id === windowId) {
          return nextWindow;
        }

        return {
          ...window,
          isFocused: nextFocusedWindow?.id === window.id,
        };
      }),
      focusedWindowId: nextFocusedWindow?.id ?? null,
    }));

    this.eventBus.emit('layout:changed', {
      windowId,
      workspaceId: targetWindow.workspaceId,
      mode: 'minimized',
    });
  }

  /**
   * Maximizes a window.
   */
  public maximizeWindow(windowId: string): void {
    const currentState = this.stateStore.getState();
    const targetWindow = currentState.windows.find((window) => window.id === windowId);

    if (!targetWindow) {
      return;
    }

    const nextWindow = this.layoutManager.maximizeWindow(
      targetWindow,
      DEFAULT_MAXIMIZED_BOUNDS,
    );

    this.replaceWindow(nextWindow, true);
  }

  /**
   * Restores a minimized or maximized window.
   */
  public restoreWindow(windowId: string): void {
    const currentState = this.stateStore.getState();
    const targetWindow = currentState.windows.find((window) => window.id === windowId);

    if (!targetWindow) {
      return;
    }

    const nextWindow = this.layoutManager.restoreWindow(targetWindow);
    this.replaceWindow(nextWindow, true);
  }

  /**
   * Moves focus to the requested window and raises its z-index.
   */
  public focusWindow(windowId: string): void {
    const currentState = this.stateStore.getState();
    const targetWindow = currentState.windows.find((window) => window.id === windowId);

    if (!targetWindow || targetWindow.mode === 'minimized') {
      return;
    }

    const nextZIndex = currentState.layout.nextZIndex;
    const focusedWindow: WindowItem = {
      ...targetWindow,
      zIndex: nextZIndex,
      isFocused: true,
      updatedAt: Date.now(),
    };

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      activeWorkspaceId: focusedWindow.workspaceId,
      focusedWindowId: focusedWindow.id,
      windows: draftState.windows.map((window) =>
        window.id === focusedWindow.id
          ? focusedWindow
          : {
              ...window,
              isFocused: false,
            },
      ),
      layout: {
        ...draftState.layout,
        nextZIndex: nextZIndex + 1,
      },
    }));

    this.eventBus.emit('window:focused', focusedWindow, {
      source: 'window-manager',
    });
  }

  private resolveWorkspace(workspaceId?: string): WorkspaceItem {
    const currentState = this.stateStore.getState();
    const targetWorkspace = currentState.workspaces.find(
      (workspace) =>
        workspace.id === (workspaceId ?? currentState.activeWorkspaceId) &&
        workspace.isOpen,
    );

    if (!targetWorkspace) {
      throw new Error('Cannot create a window without an open workspace.');
    }

    return targetWorkspace;
  }

  private replaceWindow(nextWindow: WindowItem, focusWindow: boolean): void {
    const currentState = this.stateStore.getState();
    const nextZIndex = focusWindow
      ? currentState.layout.nextZIndex
      : nextWindow.zIndex;
    const updatedWindow = focusWindow
      ? {
          ...nextWindow,
          zIndex: nextZIndex,
          isFocused: true,
        }
      : nextWindow;

    this.stateStore.updateState((draftState) => ({
      ...draftState,
      activeWorkspaceId: updatedWindow.workspaceId,
      focusedWindowId: focusWindow ? updatedWindow.id : draftState.focusedWindowId,
      windows: draftState.windows.map((window) =>
        window.id === updatedWindow.id
          ? updatedWindow
          : {
              ...window,
              isFocused: focusWindow ? false : window.isFocused,
            },
      ),
      layout: {
        ...draftState.layout,
        nextZIndex: focusWindow ? nextZIndex + 1 : draftState.layout.nextZIndex,
      },
    }));

    if (focusWindow) {
      this.eventBus.emit('window:focused', updatedWindow, {
        source: 'window-manager',
      });
    }
  }
}
